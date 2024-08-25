module.exports = function (RED) {
    "use strict";
  
    function HomeyDeviceWriteNode(config) {
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
      var value = config.value;
      var valueType = config.valueType;

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

        var valueValue;
        if (valueType != "msg") {
          // fixed
          valueValue = RED.util.evaluateNodeProperty(value, valueType, node)
        } else {
          // get valueValue from message
          valueValue = RED.util.getMessageProperty(msg, value);
        }

        node.debug('writing to device [' + deviceName + '] capability [' + capabilityName + '] value [' + valueValue + ']');
        node.homey.writeDevice(node, deviceName, capabilityName, valueValue);

        if (done) done();
      });

      // When the node is re-deployed
      this.on('close', function (removed, done) {
        node.status({});
        if (done) done();
      });
      
    }

    RED.nodes.registerType("homey-device-write", HomeyDeviceWriteNode);
    
  };