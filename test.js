const {AthomCloudAPI} = require('athom-api');
const fetch = require("node-fetch");

process.on('unhandledRejection', error => {
    // Will print "unhandledRejection err is not defined"
    console.log('unhandledRejection', error.message);
  });


// Obtained through the developer portal/Athom
var config = {
  email: 'email',
  password: 'pass',
  clientId: '5a8d4ca6eb9f7a2c9d6ccf6d',
  clientSecret: 'e3ace394af9f615857ceaa61b053f966ddcfb12a',
  redirectUrl: 'http://localhost',
  homeyCloudId: null
}

//Create a new AthomCloudAPI instance
const cloudAPI = new AthomCloudAPI({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUrl: config.redirectUrl,
});

var homeyApi;


async function getAuthorizationCode() {
    // based on https://community.athom.com/t/unsupported-homey-v2-rest-api/7268/48

    //  Step 1, get a JWT token with your credentials.  
    let url = 'https://accounts.athom.com/login'
    let response = await fetch(url, {
        "headers": {
          "accept": "application/json, text/javascript, */*; q=0.01",
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        "referrerPolicy": "no-referrer-when-downgrade",
        "body": 'email=' +encodeURIComponent(config.email) + '&password=' + encodeURIComponent(config.password) + '&otptoken=',
        "method": "POST",
        "mode": "cors",
        "credentials": "omit"
    })
    let body = await response.text()
    let token = JSON.parse(body)
    
    // Step 2, obtain an authorise redirect
    url = 'https://accounts.athom.com/oauth2/authorise?client_id=' + config.clientId + 
      '&redirect_uri=' + encodeURIComponent(config.redirectUrl) + '&response_type=code&user_token=' + token.token
    response = await fetch(url, {
      "headers": {
      },
      "method": "GET",
      "mode": "cors",
      "credentials": "include"
    })
 
    // get CSRF (Cross-site request forgery) form input token
    //    ...
    //    <input type="hidden" name="_csrf" value="HyMIxlAx-xdoe64dpEyRdp6ny5kvKFJKKxL0">
    //    ...
    body = await response.text()
    let csrf = body.split('name="_csrf" value="').pop().split('">')[0].trim();

    // get CSRF Cookie
    //    ...
    //    'set-cookie': [ '_csrf=u76gq85p7EXUCguTW4Ui_xg9; Path=/' ],
    //    ...
    let cookies = response.headers.raw()['set-cookie']
    let rawCookie = cookies.find(s => s.startsWith('_csrf='));
    let cookie = rawCookie.split(';')[0];

    // Step 3, 'mimic' the authorisation form confirmation
    url = 'https://accounts.athom.com/authorise?client_id=' + config.clientId +   '&redirect_uri=' + encodeURIComponent(config.redirectUrl) + '&response_type=code&user_token=' + token.token
    response = await fetch(url, {
      "headers": {
        "content-type": "application/x-www-form-urlencoded",
        "cookie": cookie
      },
      "redirect": "manual",
      "body": "resource=resource.homey." + config.homeyCloudId + "&_csrf=" + csrf + "&allow=Allow",
      "method": "POST",
      "mode": "cors",
      "credentials": "include"
    });
    
    // parse authentication code
    //    'Found. Redirecting to http://localhost?code=47b2ddbc716136edeeb9558bfe3dab66b93738b2'
    body = await response.text()
    let code = body.split("=")[1]
    return code;
}    
    
//This function attempts to log-in to a specific homey and returns a HomeyAPI
async function login() {
    //Check if we are logged in
    console.log('start login');
    if(!await cloudAPI.isLoggedIn()) {

        //If we are not logged in but do have an OAuth2 authorization code 
        // parameter in our URL, use it to authenticate
        if(cloudAPI.hasAuthorizationCode()) {
            await cloudAPI.authenticateWithAuthorizationCode();
        } else {
            //Redirect the user to the OAuth2 login page
            code = await getAuthorizationCode();
            await cloudAPI.authenticateWithAuthorizationCode(code);
        }
    }

    const user = await cloudAPI.getAuthenticatedUser();
    console.info('User', user.fullname, 'Authenticated');

    // Get the homey instance
    const homey = user.getHomeyById(config.homeyCloudId);

    // Start a session on this Homey
    console.info('Logging in to:', homey.name);
    homeyAPI = await homey.authenticate();

    console.info('homeyAPI created');
    return homeyAPI;
}

async function listDevices() {
  let devices = await homeyAPI.devices.getDevices({ online: true });
  Object.values(devices).forEach(device => {
    console.log(device.class, device.name);
  });
}

async function getDeviceByName(deviceName) {
  let devices = await homeyAPI.devices.getDevices();
  return Object.values(devices).find(device => device.name === deviceName);
}

async function onStateChange(capabilityObj, value, deviceName)
{
  console.log('+', deviceName, capabilityObj.id,  value, capabilityObj.units)
}

async function readDevice(deviceName, capabilityName)
{
  let device = await getDeviceByName(deviceName);
  if (!device) {
    console.log('device [' + deviceName + '] not found');
    return
  }

  let capability = device.capabilitiesObj[capabilityName];
  if (!capability) {
    console.log('capability [' + capabilityName + '] not found');
    return
  }
  console.log(device.name, capability.id,  capability.value, capability.units);
  let payload = {
    device: device.name,
    id: capability.id,
    title: capability.title,
    desc: capability.desc,
    value: capability.value,
    units: capability.units,
    lastUpdated: capability.lastUpdated
  }
  console.log(payload);
}

async function writeDevice(deviceName, capabilityName, value)
{
  let device = await getDeviceByName(deviceName);
  if (!device) {
    console.log('device [' + deviceName + '] not found');
    return
  }

  device.setCapabilityValue(capabilityName, value).
      then(data => {
      console.log(capabilityName + ' set to ' + value);
      })
      .catch(err => {
        console.log(err.message)
      })
}


async function listenChanges() {
  let device = await getDeviceByName("HEM - 3 phase");
  if (device) {
    console.log(device.capabilities);

    // let capability = device.capabilitiesObj['measure_power'];
    // console.log(capability.value, capability.units);

    // let listener = device.makeCapabilityInstance('measure_power', listenerFunc);
    let listeners = [];
    device.capabilities.forEach(cap => {
      let capability = device.capabilitiesObj[cap];
      console.log(device.name, capability.id,  capability.value, capability.units)

      let listenerFunc = async (value) => {
        onStateChange(capability, value, device.name);
      };

      listeners.push(listener = device.makeCapabilityInstance(cap, listenerFunc));
    });
    
    setTimeout(() => {
       console.log('destroying listeners');
       listeners.forEach(listener => {
        listener.destroy();
       })
    }, 60000); 
  }
}

async function sayHello() {
  //await homeyAPI.speechOutput.say({text: 'Hello'});
  // console.log("devices", devices);

  //await listDevices();

  // let notifications = await homeyAPI.notifications.getNotifications();
  // console.log(notifications);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

void async function main() {
    await login()
    await readDevice("HEM - 3 phase", "measure_power")
    await readDevice("licht kast", "onoff")
    await writeDevice("licht kast", "onoff", true)
    await sleep(5000);
    await writeDevice("licht kast", "onoff", false)
    await readDevice("licht kast", "onoff")
    //await listenChanges();
    //await sayHello()
  }()

  

