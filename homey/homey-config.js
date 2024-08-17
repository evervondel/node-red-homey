module.exports = function (RED) {
    "use strict";
    const {AthomCloudAPI} = require('athom-api');
    const fetch = require("node-fetch");

    function HomeyConfigNode(config) {
      RED.nodes.createNode(this, config);
      this.homeyAPI = null;

      // Obtained through the developer portal/Athom
      var config = {
        email: this.credentials.username,
        password: this.credentials.password,
        clientId: '5a8d4ca6eb9f7a2c9d6ccf6d',
        clientSecret: 'e3ace394af9f615857ceaa61b053f966ddcfb12a',
        redirectUrl: 'http://localhost',
        homeyCloudId: config.homeyid
      }

      //Create a new AthomCloudAPI instance
      var cloudAPI = new AthomCloudAPI({
        clientId: '5a8d4ca6eb9f7a2c9d6ccf6d',
        clientSecret: 'e3ace394af9f615857ceaa61b053f966ddcfb12a',
        redirectUrl: 'http://localhost'
      });

      login(cloudAPI, config).
        then(data => {
          this.homeyAPI = data;
          console.log("logged in");
          })
          .catch(err => {
            console.log(err.message)
          })
    }  

    async function getAuthorizationCode(config) {
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
async function login(cloudAPI, config) {
  //Check if we are logged in
  console.log('start login');
  if(!await cloudAPI.isLoggedIn()) {

      //If we are not logged in but do have an OAuth2 authorization code 
      // parameter in our URL, use it to authenticate
      if(cloudAPI.hasAuthorizationCode()) {
          await cloudAPI.authenticateWithAuthorizationCode();
      } else {
          //Redirect the user to the OAuth2 login page
          var code = await getAuthorizationCode(config);
          await cloudAPI.authenticateWithAuthorizationCode(code);
      }
  }

  const user = await cloudAPI.getAuthenticatedUser();
  console.info('User', user.fullname, 'Authenticated');

  // Get the homey instance
  var homey;
  if (config.homeyCloudId) {
    homey = user.getHomeyById(config.homeyCloudId);
  }
  else {
    homey = user.getFirstHomey();
  }

  // Start a session on this Homey
  console.info('Logging in to:', homey.name);
  var homeyAPI = await homey.authenticate();

  console.info('homeyAPI created');
  return homeyAPI;
}


  RED.nodes.registerType("homey-config", HomeyConfigNode,
  {
    credentials: {
        username: {type:"text"},
        password: {type:"password"}
    }
  });

  async function getDeviceByName(deviceName) {
    let devices = await this.homeyAPI.devices.getDevices();
    return Object.values(devices).find(device => device.name === deviceName);
  }
  
  HomeyConfigNode.prototype.writeDevice = async function writeDevice(node, deviceName, capabilityName, value)
  {
    let devices = await this.homeyAPI.devices.getDevices();
    let device = Object.values(devices).find(device => device.name === deviceName);
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
    
};