module.exports = function (RED) {
    "use strict";
  
    function HomeyDeviceWriteNode(config) {
      RED.nodes.createNode(this, config);
      const node = this;

      this.homey = RED.nodes.getNode(config.homey);

      var device = config.device;
      var deviceType = config.deviceType;
      var capability = config.capability;
      var capabilityType = config.capabilityType;
      var value = config.value;
      var valueType = config.valueType;

      this.on('input', function(msg, send, done) {
        if (node.homey)
        {
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

          var valueValue;
          if (valueType != "msg") {
            // fixed
            valueValue = RED.util.evaluateNodeProperty(value, valueType, node)
          } else {
            // get valueValue from message
            valueValue = RED.util.getMessageProperty(msg, value);
          }

          console.log('writing to device [' + deviceName + '] capability [' + capabilityName + '] value [' + valueValue + ']');

          node.homey.writeDevice(node, deviceName, capabilityName, valueValue);
        }

        if (done) done();
      });
    }

    RED.nodes.registerType("homey-device-write", HomeyDeviceWriteNode);
    
  };