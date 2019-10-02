const Plugin = require('.');

describe('Plugin', () => {

  describe('Using pseudo parameters', () => {
    let serverlessPseudoParamsPlugin;
    let resultTemplate;

    beforeEach(() => {
      const serverless = {
        cli: {
          log: () => {},
          consoleLog: () => {}
        },
        service: {
          provider: {
            compiledCloudFormationTemplate: {},
          }
        },
      };
      serverless.service.provider.compiledCloudFormationTemplate = { Resources: {
        acmeResource: {
          Type: "AWS::Foo::Bar",
          Properties: {
            AccountId: "#{AWS::AccountId}",
            Region: "#{AWS::Region}",
            NotificationARNs: "#{AWS::NotificationARNs}",
            NoValue: "#{AWS::NoValue}",
            Partition: "#{AWS::Partition}",
            StackId: "#{AWS::StackId}",
            StackName: "#{AWS::StackName}",
            URLSuffix: "#{AWS::URLSuffix}",
            Reference: "#{SomeResource}",
            Substitution: {
              "Fn::Sub": "#{SomeResource}"
            },
            Escaping: {
              StringValue: "#@{myOutputS3Loc}/#@{format(@scheduledStartTime, 'YYYY-MM-dd-HH-mm-ss')}"
            }
          }
        }
      } };
      serverlessPseudoParamsPlugin = new Plugin(serverless);
      serverlessPseudoParamsPlugin.serverless.service.service = 'foo-service';
      serverlessPseudoParamsPlugin.addParameters();
      resultTemplate = serverlessPseudoParamsPlugin.serverless.service.provider.compiledCloudFormationTemplate;
      expect(Object.keys(resultTemplate.Resources.acmeResource.Properties).length).toEqual(11);
    });

    it('replaces #{AWS::[VAR]} with the correct CF pseudo parameter', () => {
      expect(Object.keys(resultTemplate.Resources.acmeResource.Properties).length).toEqual(11);
    });

    it('replaces #{AWS::AccountId} with the ${AWS::AccountId} pseudo parameter', () => {
      expect(resultTemplate.Resources.acmeResource.Properties.AccountId).toEqual({ 'Fn::Sub': '${AWS::AccountId}' });
    });
    it('replaces #{AWS::Region} with the ${AWS::Region} pseudo parameter', () => {
      expect(resultTemplate.Resources.acmeResource.Properties.Region).toEqual({ 'Fn::Sub': '${AWS::Region}' });
    });
    it('replaces #{AWS::NotificationARNs} with the ${AWS::NotificationARNs} pseudo parameter', () => {
      expect(resultTemplate.Resources.acmeResource.Properties.NotificationARNs).toEqual({ 'Fn::Sub': '${AWS::NotificationARNs}' });
    });
    it('replaces #{AWS::NoValue} with the ${AWS::NoValue} pseudo parameter', () => {
      expect(resultTemplate.Resources.acmeResource.Properties.NoValue).toEqual({ 'Fn::Sub': '${AWS::NoValue}' });
    });
    it('replaces #{AWS::Partition} with the ${AWS::Partition} pseudo parameter', () => {
      expect(resultTemplate.Resources.acmeResource.Properties.Partition).toEqual({ 'Fn::Sub': '${AWS::Partition}' });
    });
    it('replaces #{AWS::StackId} with the ${AWS::StackId} pseudo parameter', () => {
      expect(resultTemplate.Resources.acmeResource.Properties.StackId).toEqual({ 'Fn::Sub': '${AWS::StackId}' });
    });
    it('replaces #{AWS::StackName} with the ${AWS::StackName} pseudo parameter', () => {
      expect(resultTemplate.Resources.acmeResource.Properties.StackName).toEqual({ 'Fn::Sub': '${AWS::StackName}' });
    });
    it('replaces #{AWS::URLSuffix} with the ${AWS::URLSuffix} pseudo parameter', () => {
      expect(resultTemplate.Resources.acmeResource.Properties.URLSuffix).toEqual({ 'Fn::Sub': '${AWS::URLSuffix}' });
    });
    it('replaces #{SomeResource}', () => {
      expect(resultTemplate.Resources.acmeResource.Properties.Reference).toEqual({ 'Fn::Sub': '${SomeResource}'});
    });
    it('should not add Fn::Sub to items with Fn::Sub already', () => {
      expect(resultTemplate.Resources.acmeResource.Properties.Substitution).toEqual({ 'Fn::Sub': '${SomeResource}'});
    });
    it('should not replace escaped items', () => {
      expect(resultTemplate.Resources.acmeResource.Properties.Escaping).toEqual({ 'StringValue': '#{myOutputS3Loc}/#{format(@scheduledStartTime, \'YYYY-MM-dd-HH-mm-ss\')}'});
    });
  });

  describe('Using pseudo parameters with allowReferences', () => {
    let serverlessPseudoParamsPlugin;
    let resultTemplate;

    beforeEach(() => {
      const serverless = {
        cli: {
          log: () => {},
          consoleLog: () => {}
        },
        service: {
          provider: {
            compiledCloudFormationTemplate: {},
          },
          custom: {
            pseudoParameters: {
              allowReferences: true
            }
          }
        },
      };
      serverless.service.provider.compiledCloudFormationTemplate = { Resources: {
        acmeResource: {
          Type: "AWS::Foo::Bar",
          Properties: {
            AccountId: "#{AWS::AccountId}",
            Reference: "#{SomeResource}",
          }
        }
      } };
      serverlessPseudoParamsPlugin = new Plugin(serverless);
      serverlessPseudoParamsPlugin.serverless.service.service = 'foo-service';
      serverlessPseudoParamsPlugin.addParameters();
      resultTemplate = serverlessPseudoParamsPlugin.serverless.service.provider.compiledCloudFormationTemplate;
      expect(Object.keys(resultTemplate.Resources.acmeResource.Properties).length).toEqual(2);
    });

    it('replaces #{AWS::[VAR]} with the correct CF pseudo parameter', () => {
      expect(Object.keys(resultTemplate.Resources.acmeResource.Properties).length).toEqual(2);
    });

    it('replaces #{AWS::AccountId} with the ${AWS::AccountId} pseudo parameter', () => {
      expect(resultTemplate.Resources.acmeResource.Properties.AccountId).toEqual({ 'Fn::Sub': '${AWS::AccountId}' });
    });
    it('replaces #{SomeResource} with ${SomeResource}', () => {
      expect(resultTemplate.Resources.acmeResource.Properties.Reference).toEqual({ 'Fn::Sub': '${SomeResource}' });
    });

  });

  describe('using pseudo parameters in the outputs', () => {
    let serverlessPseudoParamsPlugin;
    let resultTemplate;

    beforeEach(() => {
      const serverless = {
        cli: {
          log: () => {},
          consoleLog: () => {}
        },
        service: {
          provider: {
            compiledCloudFormationTemplate: {},
          }
        },
      };
      serverless.service.provider.compiledCloudFormationTemplate = { Outputs: {
        acmeOutput: {
          AccountId: "#{AWS::AccountId}",
          Region: "#{AWS::Region}",
          NotificationARNs: "#{AWS::NotificationARNs}",
          NoValue: "#{AWS::NoValue}",
          Partition: "#{AWS::Partition}",
          StackId: "#{AWS::StackId}",
          StackName: "#{AWS::StackName}",
          URLSuffix: "#{AWS::URLSuffix}",
        }
      } };
      serverlessPseudoParamsPlugin = new Plugin(serverless);
      serverlessPseudoParamsPlugin.serverless.service.service = 'foo-service';
      serverlessPseudoParamsPlugin.addParameters();
      resultTemplate = serverlessPseudoParamsPlugin.serverless.service.provider.compiledCloudFormationTemplate;
      expect(Object.keys(resultTemplate.Outputs.acmeOutput).length).toEqual(8);
    });

    it('replaces #{AWS::[VAR]} with the correct CF pseudo parameter', () => {
      expect(Object.keys(resultTemplate.Outputs.acmeOutput).length).toEqual(8);
    });

    it('replaces #{AWS::AccountId} with the ${AWS::AccountId} pseudo parameter', () => {
      expect(resultTemplate.Outputs.acmeOutput.AccountId).toEqual({ 'Fn::Sub': '${AWS::AccountId}' });
    });
    it('replaces #{AWS::Region} with the ${AWS::Region} pseudo parameter', () => {
      expect(resultTemplate.Outputs.acmeOutput.Region).toEqual({ 'Fn::Sub': '${AWS::Region}' });
    });
    it('replaces #{AWS::NotificationARNs} with the ${AWS::NotificationARNs} pseudo parameter', () => {
      expect(resultTemplate.Outputs.acmeOutput.NotificationARNs).toEqual({ 'Fn::Sub': '${AWS::NotificationARNs}' });
    });
    it('replaces #{AWS::NoValue} with the ${AWS::NoValue} pseudo parameter', () => {
      expect(resultTemplate.Outputs.acmeOutput.NoValue).toEqual({ 'Fn::Sub': '${AWS::NoValue}' });
    });
    it('replaces #{AWS::Partition} with the ${AWS::Partition} pseudo parameter', () => {
      expect(resultTemplate.Outputs.acmeOutput.Partition).toEqual({ 'Fn::Sub': '${AWS::Partition}' });
    });
    it('replaces #{AWS::StackId} with the ${AWS::StackId} pseudo parameter', () => {
      expect(resultTemplate.Outputs.acmeOutput.StackId).toEqual({ 'Fn::Sub': '${AWS::StackId}' });
    });
    it('replaces #{AWS::StackName} with the ${AWS::StackName} pseudo parameter', () => {
      expect(resultTemplate.Outputs.acmeOutput.StackName).toEqual({ 'Fn::Sub': '${AWS::StackName}' });
    });
    it('replaces #{AWS::URLSuffix} with the ${AWS::URLSuffix} pseudo parameter', () => {
      expect(resultTemplate.Outputs.acmeOutput.URLSuffix).toEqual({ 'Fn::Sub': '${AWS::URLSuffix}' });
    });
  })



});
