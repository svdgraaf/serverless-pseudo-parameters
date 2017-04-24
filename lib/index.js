'use strict';

const _ = require('lodash');

class ServerlessAWSPseudoParameters {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.hooks = {
      'before:deploy:deploy': this.addParameters.bind(this),
    };
  }

  addParameters() {
    this.serverless.cli.consoleLog('');
    const template = this.serverless.service.provider.compiledCloudFormationTemplate;

    // loop through all resources, and check all (string) properties for any #{AWS::}
    // reference. If found, replace the value with an Fn::Sub reference
    _.forEach(template.Resources, function(resource, identifier){
      _.forEach(resource.Properties, function(value, key){
        // we only want to possibly replace strings with an Fn::Sub
        if(typeof value === 'string' && value.search(/#{AWS::([a-zA-Z]+)}/) >= 0) {
          resource.Properties[key] = {
            "Fn::Sub": value.replace(/#{AWS::([a-zA-Z]+)}/g, '${AWS::$1}')
          }

          console.info('[ ' + identifier + '::' + key + ' ] Replaced #{AWS::} reference(s) with Fn::Sub')

        }
      });
    })
  }
}

module.exports = ServerlessAWSPseudoParameters;
