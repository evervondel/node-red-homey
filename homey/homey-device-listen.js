module.exports = function (RED) {
    "use strict";
  
    function HomeyDeviceListenNode(config) {
      RED.nodes.createNode(this, config);
      const node = this;

      this.homey = RED.nodes.getNode(config.homey);
      this.listeners = null;

      var device = config.device;
      var deviceType = config.deviceType;
      var capability = config.capability;
      var capabilityType = config.capabilityType;

      if (node.homey) {
        var deviceName;
        if (deviceType === "str") {
          // fixed
          deviceName = device;
        } else {
          // get deviceName from message
          deviceName = RED.util.getMessageProperty(msg, device);
        }

        var capabilityName;
        if (capabilityType === "str") {
          // fixed
          capabilityName = capability;
        } else {
          // get capabilityName from message
          capabilityName = RED.util.getMessageProperty(msg, capability);
        }

        node.homey.getDevice(node, deviceName).
        then(data => {
          if (data) {
            let device = data;
            let capListeners = [];
            let listener;  

            if (capabilityName) {
              // register a single capability
              let capability = device.capabilitiesObj[capabilityName];

              let listenerFunc = async (value) => {
                onStateChange(node, capability, value, device.name);
              };
        
              capListeners.push(listener = device.makeCapabilityInstance(capabilityName, listenerFunc));

            } else {

              // register all capabilities
              device.capabilities.forEach(cap => {
                let capability = device.capabilitiesObj[cap];
                let listenerFunc = async (value) => {
                  onStateChange(node, capability, value, device.name);
                };
          
                capListeners.push(listener = device.makeCapabilityInstance(cap, listenerFunc));
              });
            }
            this.listeners = capListeners;

            node.status({fill:"green",shape:"ring",text: deviceName + ' listening'});
            node.debug(deviceName + ' listening');
          }
        })
        .catch(err => {
          node.status({fill:"red",shape:"ring",text: deviceName + ' not found'});
          node.warn(err.message);  
        })
      }

      // When the node is re-deployed
      this.on('close', function (removed, done) {
        if (node.homey) {
        
          if (this.listeners) {
            console.log('closing listeners');
            listeners.forEach(listener => {
              listener.destroy();
             })
          }

          node.homey.close(node)
        }
        if (done) done();
      });     
    }

    async function onStateChange(node, capability, value, deviceName)
    {
      console.log('+', deviceName, capability.id,  value, capability.units)
      let payload = {
        device: deviceName,
        id: capability.id,
        title: capability.title,
        desc: capability.desc,
        value: value,
        units: capability.units,
        lastUpdated: capability.lastUpdated
      }
      let msg = {
        payload: payload
      }
      node.send(msg);
    }
    

    RED.nodes.registerType("homey-device-listen", HomeyDeviceListenNode);
    
  };