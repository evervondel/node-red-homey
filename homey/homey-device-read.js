module.exports = function (RED) {
    "use strict";
  
    function HomeyDeviceReadNode(config) {
      RED.nodes.createNode(this, config);
      const node = this;

      this.homey = RED.nodes.getNode(config.homey);
      if (!this.homey) {
        node.status({fill:"red",shape:"ring",text: 'homey config is missing'});
        node.error('homey config is missing');
        return;
      }

      var device = config.device;
      var deviceType = config.deviceType;
      var capability = config.capability;
      var capabilityType = config.capabilityType;

      this.on('input', function(msg, send, done) {
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

        node.debug('read from device [' + deviceName + '] capability [' + capabilityName + ']');
        node.homey.readDevice(node, deviceName, capabilityName).
        then(data => {
          if (data) {
            msg.payload = data;
            send(msg);
          }
          if (done) done();
        })
        .catch(err => {
          node.status({fill:"red",shape:"ring",text: deviceName + '.' + capabilityName + ' not read'});
          node.warn(err.message);  
          if (done) done(err);
        })
      });

      // When the node is re-deployed
      this.on('close', function (removed, done) {
        node.status({});
        if (done) done();
      });
      
    }

    RED.nodes.registerType("homey-device-read", HomeyDeviceReadNode);
    
  };