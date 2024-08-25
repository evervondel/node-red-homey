module.exports = function (RED) {
    "use strict";
  
    function HomeyFlowTriggerNode(config) {
      RED.nodes.createNode(this, config);
      const node = this;

      this.homey = RED.nodes.getNode(config.homey);
      if (!this.homey) {
        node.status({fill:"red",shape:"ring",text: 'homey config is missing'});
        node.error('homey config is missing');
        return;
      }

      var flow = config.flow;
      var flowType = config.flowType
      var advanced = config.advanced;

      this.on('input', function(msg, send, done) {
        var flowName;
        if (flowType === "str") {
          // fixed
          flowName = flow;
        } else {
          // get flowName from message
          flowName = RED.util.getMessageProperty(msg, flow);
        }

        node.debug('trigger ' + (advanced ? 'advanced ' : ' ') + 'flow [' + flowName + ']');
        node.homey.triggerFlow(node, flowName, advanced);

        if (done) done();
      });

      // When the node is re-deployed
      this.on('close', function (removed, done) {
        node.status({});
        if (done) done();
      });
      
    }

    RED.nodes.registerType("homey-flow-trigger", HomeyFlowTriggerNode);
    
  };