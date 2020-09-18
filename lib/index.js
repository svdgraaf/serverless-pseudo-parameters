'use strict';

class ServerlessAWSPseudoParameters {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options || {};
    this.hooks = {
      'invoke:local:loadEnvVars': this.invokeLocal.bind(this),
      'deploy:function:initialize': this.deployFunction.bind(this),
      'after:aws:package:finalize:mergeCustomProviderResources': this.addParameters.bind(
        this
      )
    };
    this.skipRegionReplace = get(
      serverless.service,
      'custom.pseudoParameters.skipRegionReplace',
      true
    );
    this.allowReferences = get(
      serverless.service,
      'custom.pseudoParameters.allowReferences',
      true
    );
    this.colors = get(this.serverless, 'processedInput.options.color', true);
    this.debug = this.options.debug || process.env.SLS_DEBUG;
  }

  awsRegex(allowReferences) {
    return allowReferences ? /#{([^}]+)}/g : /#{(AWS::[a-zA-Z]+)}/g;
  }

  async runtimeResolveAWSVariables(stringifiedParameters) {
    // Resolve parameters
    const resolvedVariables = (
      await Promise.all(
        (stringifiedParameters.match(this.awsRegex(this.allowReferences)) || [])
          .reduce((acc, match) => {
            if (!acc.includes(match)) {
              acc.push(match);
            }
            return acc;
          }, [])
          .map(async (match) => {
            const region =
              this.serverless.processedInput.region ||
              this.serverless.service.provider.region;
            switch (match) {
              case '#{AWS::Region}':
                return {
                  [match]: region
                };
              case '#{AWS::AccountId}':
                const sts = new this.serverless.providers.aws.sdk.STS();
                const { Account } = await sts.getCallerIdentity({}).promise();
                return { [match]: Account };
              case '#{AWS::Partition}':
                if (/^us\-gov/.test(region)) {
                  return { [match]: 'aws-us-gov' };
                } else if (/^cn\-/.test(region)) {
                  return { [match]: 'aws-cn' };
                }
                return { [match]: 'aws' };
              case '#{AWS::NoValue}':
                return { [match]: undefined };
              case '#{AWS::NotificationARNs}':
                throw new Error('#{AWS::NotificationARNs} not implemented');
              case '#{AWS::StackName}':
                return {
                  [match]: this.serverless.providers.aws.naming.getStackName()
                };
              case '#{AWS::StackId}':
                const cloudformation = new this.serverless.providers.aws.sdk.CloudFormation(
                  { region }
                );
                let nextTokenListStacks;
                let stackId;
                do {
                  const {
                    StackSummaries,
                    NextToken
                  } = await cloudformation
                    .listStacks({ NextToken: nextTokenListStacks })
                    .promise();
                  const stackSummary = StackSummaries.find(
                    ({ StackName }) =>
                      StackName ===
                      this.serverless.providers.aws.naming.getStackName()
                  );
                  if (stackSummary) {
                    nextTokenListStacks = null;
                    stackId = stackSummary.StackId;
                  } else {
                    nextTokenListStacks = NextToken;
                  }
                } while (nextTokenListStacks);
                return {
                  [match]: stackId
                };
              case '#{AWS::URLSuffix}':
                if (/^cn\-/.test(region)) {
                  return { [match]: 'amazonaws.com.cn' };
                }
                return { [match]: 'amazonaws.com' };
              default:
                return { [match]: match };
            }
          })
      )
    ).reduce((acc, item) => Object.assign(acc, item), {});

    // replace matches and return resolved object
    return JSON.parse(
      stringifiedParameters.replace(
        this.awsRegex(this.allowReferences),
        (match) => resolvedVariables[match]
      )
    );
  }

  async invokeLocal() {
    // merge resolved environmental variables system environmental variables
    const stringifiedProviderEnvironment = JSON.stringify(
      this.serverless.service.provider.environment || {}
    );
    Object.assign(
      process.env,
      await this.runtimeResolveAWSVariables(stringifiedProviderEnvironment)
    );
    const stringifiedFunctionObjectEnvironment = JSON.stringify(
      this.serverless.processedInput.options.functionObj.environment || {}
    );
    Object.assign(
      process.env,
      await this.runtimeResolveAWSVariables(
        stringifiedFunctionObjectEnvironment
      )
    );
  }

  async deployFunction() {
    // merge resolved variables to function object
    const stringifiedProviderEnvironment = JSON.stringify(
      this.serverless.service.provider.environment || {}
    );
    Object.assign(
      this.serverless.service.provider.environment || {},
      await this.runtimeResolveAWSVariables(stringifiedProviderEnvironment)
    );
    const stringifiedFunctionObject = JSON.stringify(
      this.serverless.processedInput.options.functionObj
    );
    Object.assign(
      this.serverless.processedInput.options.functionObj,
      await this.runtimeResolveAWSVariables(stringifiedFunctionObject)
    );
  }

  addParameters() {
    const template = this.serverless.service.provider
      .compiledCloudFormationTemplate;
    const skipRegionReplace = this.skipRegionReplace;
    const allowReferences = this.allowReferences;
    const colors = this.colors;
    const debug = this.debug;
    const consoleLog = this.serverless.cli.consoleLog;
    const awsRegex = this.awsRegex;

    if (debug) consoleLog(yellow(underline('AWS Pseudo Parameters')));

    if (skipRegionReplace && debug) {
      consoleLog(
        'Skipping automatic replacement of regions with account region!'
      );
    }

    // loop through the entire template, and check all (string) properties for any #{AWS::}
    // reference. If found, replace the value with an Fn::Sub reference
    Object.keys(template).forEach((identifier) => {
      replaceChildNodes(template[identifier], identifier);
    });

    function isDict(v) {
      return (
        typeof v === 'object' &&
        v !== null &&
        !(v instanceof Array) &&
        !(v instanceof Date)
      );
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
        if (
          typeof value === 'string' &&
          !skipRegionReplace &&
          containsRegion(value)
        ) {
          const regionFinder = new RegExp(regions().join('|'));
          value = value.replace(regionFinder, '#{AWS::Region}');
        }

        const aws_regex = awsRegex(allowReferences);

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
