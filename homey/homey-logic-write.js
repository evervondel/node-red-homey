module.exports = function (RED) {
    "use strict";
  
    function HomeyLogicWriteNode(config) {
      RED.nodes.createNode(this, config);
      const node = this;

      this.homey = RED.nodes.getNode(config.homey);
      if (!this.homey) {
        node.status({fill:"red",shape:"ring",text: 'homey config is missing'});
        node.error('homey config is missing');
        return;
      }

      var variable = config.variable;
      var variableType = config.variableType;
      var value = config.value;
      var valueType = config.valueType;

      this.on('input', function(msg, send, done) {
        var variableName;
        if (variableType === "str") {
          // fixed
          variableName = variable;
        } else {
          // get variableName from message
          variableName = RED.util.getMessageProperty(msg, variable);
        }

        var valueValue;
        if (valueType != "msg") {
          // fixed
          valueValue = RED.util.evaluateNodeProperty(value, valueType, node)
        } else {
          // get valueValue from message
          valueValue = RED.util.getMessageProperty(msg, value);
        }

        node.debug('writing variable [' + variableName + '] value [' + valueValue + ']');
        node.homey.writeVariable(node, variableName, valueValue);

        if (done) done();
      });

      // When the node is re-deployed
      this.on('close', function (removed, done) {
        node.status({});
        if (done) done();
      });     
    }

    RED.nodes.registerType("homey-logic-write", HomeyLogicWriteNode);
    
  };