module.exports = function (RED) {
    "use strict";
  
    function HomeyDeviceReadNode(config) {
      RED.nodes.createNode(this, config);
      const node = this;

      this.homey = RED.nodes.getNode(config.homey);

      var device = config.device;
      var deviceType = config.deviceType;
      var capability = config.capability;
      var capabilityType = config.capabilityType;

      this.on('input', function(msg, send, done) {
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
        }

      });

      // When the node is re-deployed
      this.on('close', function (removed, done) {
        if (node.homey) {
          node.homey.close(node)
        }
        if (done) done();
      });
      
    }

    RED.nodes.registerType("homey-device-read", HomeyDeviceReadNode);
    
  };