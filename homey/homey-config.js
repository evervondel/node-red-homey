module.exports = function (RED) {
    "use strict";
    const AthomCloudAPI = require('homey-api/lib/AthomCloudAPI');
    const {HomeyAPI} = require('homey-api');
    const fetch = require("node-fetch");
    //Create a new AthomCloudAPI instance
    const cloudAPI = new AthomCloudAPI({
      clientId: '5a8d4ca6eb9f7a2c9d6ccf6d',
      clientSecret: 'e3ace394af9f615857ceaa61b053f966ddcfb12a',
      redirectUrl: 'http://localhost'
    });

    function HomeyConfigNode(config) {
      RED.nodes.createNode(this, config);
      this.homeyAPI = null;

      var homeyConfig = {
        connection: config.connection,
        // Cloud API
        email: this.credentials.username,
        password: this.credentials.password,
        clientId: '5a8d4ca6eb9f7a2c9d6ccf6d',
        clientSecret: 'e3ace394af9f615857ceaa61b053f966ddcfb12a',
        redirectUrl: 'http://localhost',
        homeyCloudId: config.homeyid,
        // Local API
        address: config.address,
        apiToken: this.credentials.apitoken
      }
      this.homeyConfig = homeyConfig;
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
  async function login(homeyConfig) {

    if (homeyConfig.connection === 'local') {
      // LOCAL API
      console.info('Logging in to:', homeyConfig.apiToken);
      const homeyAPI = await HomeyAPI.createLocalAPI({
        address: homeyConfig.address,
        token: homeyConfig.apiToken
      });
    
      return homeyAPI;
    }
    else {
      // CLOUD API
      if(!await cloudAPI.isLoggedIn()) {
          //If we are not logged in but do have an OAuth2 authorization code 
          // parameter in our URL, use it to authenticate
          if(cloudAPI.hasAuthorizationCode()) {
              await cloudAPI.authenticateWithAuthorizationCode();
          } else {
              //Redirect the user to the (simulated) OAuth2 login page
              var code = await getAuthorizationCode(homeyConfig);
              await cloudAPI.authenticateWithAuthorizationCode({code: code});
          }
      }

      const user = await cloudAPI.getAuthenticatedUser();
      console.info('User', user.fullname, 'Authenticated');

      // Get the homey instance
      var homey;
      if (homeyConfig.homeyCloudId) {
        homey = user.getHomeyById(homeyConfig.homeyCloudId);
      }
      else {
        homey = user.getFirstHomey();
      }

      // Start a session on this Homey
      console.info('Logging in to:', homey.name);
      var homeyAPI = await homey.authenticate();
      return homeyAPI;
    }
  }


  RED.nodes.registerType("homey-config", HomeyConfigNode,
  {
    credentials: {
        username: {type:"text"},
        password: {type:"password"},
        apitoken: {type:"password"}
    }
  });

  HomeyConfigNode.prototype.getDevice = async function getDevice(node, deviceName)
  {
    if (!this.homeyAPI) {
      this.homeyAPI = await login(this.homeyConfig);
    }

    let devices = await this.homeyAPI.devices.getDevices();
    let device = Object.values(devices).find(device => device.name === deviceName);
    if (!device) {
      node.status({fill:"red",shape:"ring",text: deviceName + " not found"});
      node.warn('device [' + deviceName + '] not found');  
      return null;
    }

    return device
  }

  HomeyConfigNode.prototype.writeDevice = async function writeDevice(node, deviceName, capabilityName, value)
  {
    if (!this.homeyAPI) {
      this.homeyAPI = await login(this.homeyConfig);
    }

    let devices = await this.homeyAPI.devices.getDevices();
    let device = Object.values(devices).find(device => device.name === deviceName);
    if (!device) {
      node.status({fill:"red",shape:"ring",text: deviceName + " not found"});
      node.warn('device [' + deviceName + '] not found');  
      return
    }
  
    device.setCapabilityValue(capabilityName, value).
        then(data => {
          node.status({fill:"green",shape:"ring",text: deviceName + '.' + capabilityName + ' = ' + value});
          node.debug(deviceName + '.' + capabilityName + ' = ' + value);
        })
        .catch(err => {
          node.status({fill:"red",shape:"ring",text: deviceName + '.' + capabilityName + ' not set'});
          node.warn(err.message);  
        })
  }

  HomeyConfigNode.prototype.readDevice = async function readDevice(node, deviceName, capabilityName)
  {
    if (!this.homeyAPI) {
      this.homeyAPI = await login(this.homeyConfig);
    }

    let devices = await this.homeyAPI.devices.getDevices();
    let device = Object.values(devices).find(device => device.name === deviceName);
    if (!device) {
      node.status({fill:"red",shape:"ring",text: deviceName + " not found"});
      node.warn('device [' + deviceName + '] not found');  
      return null;
    }
  
    let capability = device.capabilitiesObj[capabilityName];
    if (!capability) {
      node.status({fill:"red",shape:"ring",text: deviceName + '.' + capabilityName + " not found"});
      node.warn('device [' + deviceName + '] capability [' + capabilityName + '] not found');  
      return null;
    }

    let payload = {
      device: device.name,
      id: capability.id,
      title: capability.title,
      desc: capability.desc,
      value: capability.value,
      units: capability.units,
      lastUpdated: capability.lastUpdated
    }
    return payload
  }


  HomeyConfigNode.prototype.close = async function close(node)
  {
    if (this.homeyAPI) {
      console.log('closing homeyAPI');
/*
      cloudAPI.logout().then(() => {
        console.log('logged out');
        this.homeyAPI = null;
      })
      .catch(err => {
        console.log('logout error', err);
        this.homeyAPI = null;
      });
*/
    node.status({});
    this.homeyAPI = null;
    }
  }

};