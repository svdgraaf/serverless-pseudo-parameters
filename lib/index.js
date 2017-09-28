'use strict';

const _ = require('lodash');
const chalk = require('chalk');


class ServerlessAWSPseudoParameters {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.hooks = {
      'before:deploy:deploy': this.addParameters.bind(this),
    };
    this.skipRegionReplace = _.get(serverless.service, 'custom.pseudoParameters.skipRegionReplace', false)
  }

  addParameters() {

    const template = this.serverless.service.provider.compiledCloudFormationTemplate;
    const skipRegionReplace = this.skipRegionReplace;
    const consoleLog = this.serverless.cli.consoleLog;

    consoleLog(`${chalk.yellow.underline('AWS Pseudo Parameters')}`);

    if (skipRegionReplace) {
      consoleLog('Skipping automatic replacement of regions with account region!');
    }

    // loop through all resources, and check all (string) properties for any #{AWS::}
    // reference. If found, replace the value with an Fn::Sub reference
    _.forEach(template.Resources, function(resource, identifier){
      replaceChildNodes(resource.Properties, identifier);
    });

    function isDict(v) {
      return typeof v==='object' && v!==null && !(v instanceof Array) && !(v instanceof Date);
    }

    function isArray(v) {
      return Object.prototype.toString.call(v) === '[object Array]'
    }

    function regions() {
      return [
        'eu-west-1',
        'eu-west-2',
        'us-east-1',
        'us-east-2',
        'us-west-2',
        'ap-south-1',
        'ap-northeast-2',
        'ap-southeast-2',
        'ap-northeast-1',
        'eu-central-1'
      ]
    }

    function containsRegion(v) {
      return new RegExp(regions().join("|")).test(v);
    }

    function replaceChildNodes(dictionary, name) {
        _.forEach(dictionary, function(value, key){

          // if a region name is mentioned, replace it with a reference (unless we are skipping automatic replacements)
          if(typeof value === 'string' && !skipRegionReplace && containsRegion(value)) {
            var regionFinder = new RegExp(regions().join("|"));
            value = value.replace(regionFinder, '#{AWS::Region}');
          }

          // we only want to possibly replace strings with an Fn::Sub
          if(typeof value === 'string' && value.search(/#{AWS::([a-zA-Z]+)}/) >= 0) {
            var aws_regex = /#{AWS::([a-zA-Z]+)}/g;
            var m;

            dictionary[key] = {
              "Fn::Sub": value.replace(aws_regex, '${AWS::$1}')
            }

            // do some fancy logging
            do {
              var m = aws_regex.exec(value);
              if (m) {
                var msg = name + '::' + key + ' Replaced ' + chalk.yellow(m[1]) + ' with ' + chalk.yellow('${AWS::' + m[1] + '}');
                // this.serverless.cli.consoleLog(message);
                consoleLog('AWS Pseudo Parameter: ' + msg)
              }
            } while (m);
          }

          // dicts and arrays need to be looped through
          if (isDict(value) || isArray(value)) {
            dictionary[key] = replaceChildNodes(value, name + '::' + key);
          }

        });
        return dictionary;
      }

  }

}

module.exports = ServerlessAWSPseudoParameters;
