module.exports = function (RED) {
    "use strict";
  
    function HomeyLogicReadNode(config) {
      RED.nodes.createNode(this, config);
      const node = this;

      this.homey = RED.nodes.getNode(config.homey);

      var variable = config.variable;
      var variableType = config.variableType;

      this.on('input', function(msg, send, done) {
        if (node.homey) {
          var variableName;
          if (variableType === "str") {
            // fixed
            variableName = variable;
          } else {
            // get variableName from message
            variableName = RED.util.getMessageProperty(msg, variable);
          }

          node.debug('read variable [' + variableName + ']');
          node.homey.readVariable(node, variableName).
          then(data => {
            if (data) {
              msg.payload = data;
              send(msg);
            }
            if (done) done();
          })
          .catch(err => {
            node.status({fill:"red",shape:"ring",text: variableName + ' not read'});
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

    RED.nodes.registerType("homey-logic-read", HomeyLogicReadNode);
    
  };