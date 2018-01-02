'use strict';

class ServerlessAWSPseudoParameters {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.hooks = {
      'before:deploy:deploy': this.addParameters.bind(this),
    };
    this.skipRegionReplace = get(serverless.service, 'custom.pseudoParameters.skipRegionReplace', false)
  }

  addParameters() {

    const resources = this.serverless.service.provider.compiledCloudFormationTemplate.Resources;
    const skipRegionReplace = this.skipRegionReplace;
    const consoleLog = this.serverless.cli.consoleLog;

    consoleLog(yellow(underline('AWS Pseudo Parameters')));

    if (skipRegionReplace) {
      consoleLog('Skipping automatic replacement of regions with account region!');
    }

    // loop through all resources, and check all (string) properties for any #{AWS::}
    // reference. If found, replace the value with an Fn::Sub reference
    Object.keys(resources).forEach(identifier => replaceChildNodes(resources[identifier].Properties, identifier));

    function isDict(v) {
      return typeof v === 'object' && v !== null && !(v instanceof Array) && !(v instanceof Date);
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
      Object.keys(dictionary).forEach((key) => {

        let value = dictionary[key];
        // if a region name is mentioned, replace it with a reference (unless we are skipping automatic replacements)
        if (typeof value === 'string' && !skipRegionReplace && containsRegion(value)) {
          const regionFinder = new RegExp(regions().join("|"));
          value = value.replace(regionFinder, '#{AWS::Region}');
        }

        // we only want to possibly replace strings with an Fn::Sub
        if (typeof value === 'string' && value.search(/#{AWS::([a-zA-Z]+)}/) >= 0) {
          const aws_regex = /#{AWS::([a-zA-Z]+)}/g;

          dictionary[key] = {
            "Fn::Sub": value.replace(aws_regex, '${AWS::$1}')
          };

          // do some fancy logging
          let m = aws_regex.exec(value);
          while (m) {
            consoleLog('AWS Pseudo Parameter: ' + name + '::' + key + ' Replaced ' + yellow(m[1]) + ' with ' + yellow('${AWS::' + m[1] + '}'));
            m = aws_regex.exec(value);
          }
        }

        // dicts and arrays need to be looped through
        if (isDict(value) || isArray(value)) {
          dictionary[key] = replaceChildNodes(value, name + '::' + key);
        }

      });
      return dictionary;
    }

    function yellow(str) {
      return '\u001B[33m' + str + '\u001B[39m';
    }

    function underline(str) {
      return '\u001B[4m' + str + '\u001B[24m';
    }
  }
}

function get(obj, path, def) {
  return path.split('.').filter(Boolean).every(step => !(step && (obj = obj[step]) === undefined)) ? obj : def;
}

module.exports = ServerlessAWSPseudoParameters;
