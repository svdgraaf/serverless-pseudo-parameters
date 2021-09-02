'use strict';

const semver = require('semver');

class ServerlessAWSPseudoParameters {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options || {};
    this.hooks = {
      initialize: () => {
        if (!serverless.version) return;
        if (!semver.gte(serverless.version, '2.50.0')) return;
        this.serverless.logDeprecation(
          'OBSOLETE_PSEUDO_PARAMETERS_PLUGIN',
          '"serverless-pseudo-parameters" plugin is no longer needed. Please uninstall it as it will not work with next Framework major release.\n' +
            'Instead rely on "${aws:region}" and "${aws:accountId}" Serverless Framework variables'
        );
      },
      'after:aws:package:finalize:mergeCustomProviderResources': this.addParameters.bind(this)
    };
    this.skipRegionReplace = get(
      serverless.service,
      'custom.pseudoParameters.skipRegionReplace',
      true
    );
    this.allowReferences = get(serverless.service, 'custom.pseudoParameters.allowReferences', true);
    this.colors = get(this.serverless, 'processedInput.options.color', true);
    this.debug = this.options.debug || process.env.SLS_DEBUG;
  }

  addParameters() {
    const template = this.serverless.service.provider.compiledCloudFormationTemplate;
    const skipRegionReplace = this.skipRegionReplace;
    const allowReferences = this.allowReferences;
    const colors = this.colors;
    const debug = this.debug;
    const consoleLog = this.serverless.cli.consoleLog;

    if (debug) consoleLog(yellow(underline('AWS Pseudo Parameters')));

    if (skipRegionReplace && debug) {
      consoleLog('Skipping automatic replacement of regions with account region!');
    }

    // loop through the entire template, and check all (string) properties for any #{AWS::}
    // reference. If found, replace the value with an Fn::Sub reference
    Object.keys(template).forEach((identifier) => {
      replaceChildNodes(template[identifier], identifier);
    });

    function isDict(v) {
      return typeof v === 'object' && v !== null && !(v instanceof Array) && !(v instanceof Date);
    }

    function isArray(v) {
      return Object.prototype.toString.call(v) === '[object Array]';
    }

    function regions() {
      return [
        'ap-northeast-1',
        'ap-northeast-2',
        'ap-south-1',
        'ap-southeast-1',
        'ap-southeast-2',
        'ca-central-1',
        'eu-central-1',
        'eu-west-1',
        'eu-west-2',
        'eu-west-3',
        'sa-east-1',
        'us-east-1',
        'us-east-2',
        'us-west-1',
        'us-west-2'
      ];
    }

    function containsRegion(v) {
      return new RegExp(regions().join('|')).test(v);
    }

    function replaceChildNodes(dictionary, name) {
      Object.keys(dictionary).forEach((key) => {
        let value = dictionary[key];
        // if a region name is mentioned, replace it with a reference (unless we are skipping automatic replacements)
        if (typeof value === 'string' && !skipRegionReplace && containsRegion(value)) {
          const regionFinder = new RegExp(regions().join('|'));
          value = value.replace(regionFinder, '#{AWS::Region}');
        }

        var aws_regex;
        if (allowReferences) {
          aws_regex = /#{([^}]+)}/g;
        } else {
          aws_regex = /#{(AWS::[a-zA-Z]+)}/g;
        }

        // we only want to possibly replace strings with an Fn::Sub
        if (typeof value === 'string' && value.search(aws_regex) >= 0) {
          let replacedString = value.replace(aws_regex, '${$1}');

          if (key === 'Fn::Sub') {
            dictionary[key] = replacedString;
          } else {
            dictionary[key] = {
              'Fn::Sub': replacedString
            };
          }

          if (debug) {
            // do some fancy logging
            let m = aws_regex.exec(value);
            while (m) {
              consoleLog(
                'AWS Pseudo Parameter: ' +
                  name +
                  '::' +
                  key +
                  ' Replaced ' +
                  yellow(m[1]) +
                  ' with ' +
                  yellow('${' + m[1] + '}')
              );
              m = aws_regex.exec(value);
            }
          }
        }

        var escaped_regex = /#@{([^}]+)}/g;
        if (typeof value === 'string' && value.search(escaped_regex) >= 0) {
          let replacedString = value.replace(escaped_regex, '#{$1}');
          dictionary[key] = replacedString;
        }

        // dicts and arrays need to be looped through
        if (isDict(value) || isArray(value)) {
          dictionary[key] = replaceChildNodes(value, name + '::' + key);
        }
      });
      return dictionary;
    }

    function yellow(str) {
      if (colors) return '\u001B[33m' + str + '\u001B[39m';
      return str;
    }

    function underline(str) {
      if (colors) return '\u001B[4m' + str + '\u001B[24m';
      return str;
    }
  }
}

function get(obj, path, def) {
  return path
    .split('.')
    .filter(Boolean)
    .every((step) => !(step && (obj = obj[step]) === undefined))
    ? obj
    : def;
}

module.exports = ServerlessAWSPseudoParameters;
