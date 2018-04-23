'use strict';

class ServerlessAWSPseudoParameters {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.hooks = {
      'after:aws:package:finalize:mergeCustomProviderResources': this.addParameters.bind(this),
    };
    this.skipRegionReplace = get(serverless.service, 'custom.pseudoParameters.skipRegionReplace', false)
    this.allowReferences = get(serverless.service, 'custom.pseudoParameters.allowReferences', false)
  }

  addParameters() {

    const template = this.serverless.service.provider.compiledCloudFormationTemplate;
    const skipRegionReplace = this.skipRegionReplace;
    const allowReferences = this.allowReferences;
    const consoleLog = this.serverless.cli.consoleLog;

    consoleLog(yellow(underline('AWS Pseudo Parameters')));

    if (skipRegionReplace) {
      consoleLog('Skipping automatic replacement of regions with account region!');
    }

    // loop through the entire template, and check all (string) properties for any #{AWS::}
    // reference. If found, replace the value with an Fn::Sub reference
    Object.keys(template).forEach(identifier => {
      replaceChildNodes(template[identifier], identifier)
    });


    function isDict(v) {
      return typeof v === 'object' && v !== null && !(v instanceof Array) && !(v instanceof Date);
    }

    function isArray(v) {
      return Object.prototype.toString.call(v) === '[object Array]'
    }

    function regions() {
      return [
        "ap-northeast-1",
        "ap-northeast-2",
        "ap-south-1",
        "ap-southeast-1",
        "ap-southeast-2",
        "ca-central-1",
        "eu-central-1",
        "eu-west-1",
        "eu-west-2",
        "eu-west-3",
        "sa-east-1",
        "us-east-1",
        "us-east-2",
        "us-west-1",
        "us-west-2"
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

        var aws_regex;
        if (allowReferences) {
          aws_regex = /#{([^}]+)}/g;
        } else {
          aws_regex = /#{(AWS::[a-zA-Z]+)}/g
        }

        // we only want to possibly replace strings with an Fn::Sub
        if (typeof value === 'string' && value.search(aws_regex) >= 0) {
          dictionary[key] = {
            "Fn::Sub": value.replace(aws_regex, '${$1}')
          };

          // do some fancy logging
          let m = aws_regex.exec(value);
          while (m) {
            consoleLog('AWS Pseudo Parameter: ' + name + '::' + key + ' Replaced ' + yellow(m[1]) + ' with ' + yellow('${' + m[1] + '}'));
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
