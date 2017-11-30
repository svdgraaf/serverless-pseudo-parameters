Serverless AWS Pseudo Parameters
--------------------------------

Currently, it's impossible (or at least, very hard) to use the [CloudFormation Pseudo Parameters](http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/pseudo-parameter-reference.html) in your `serverless.yml`.

This plugin fixes that.

You can now use `#{AWS::AccountId}`, `#{AWS::Region}`, etc. in any of your config strings, and this plugin replaces those values with the proper pseudo parameter `Fn::Sub` CloudFormation function.

Installation
-----
Install the package with npm: `npm install serverless-pseudo-parameters`, and add it to your `serverless.yml` plugins list:

```yaml
plugins:
  - serverless-pseudo-parameters
```

Usage
-----
Add one of the pseudo parameters to any resource parameter, and it will be replaced during deployment. Mind you to replace the default `${}` with a `#{}`. So `${AWS::AccountId}`, becomes: `#{AWS::AccountId}` etc.

For example, this configuration will create a bucket with your account id appended to the bucket name:

```yaml
service: users-bucket-thingy

plugins:
  - serverless-pseudo-parameters

functions:
  users:
    handler: users.handler
    events:
      - s3:
          bucket: photos-#{AWS::AccountId}
          event: s3:ObjectRemoved:*
```

The output in the cloudformation template will look something like this:

```json
"Type": "AWS::S3::Bucket",
"Properties": {
  "BucketName": {
    "Fn::Sub": "photos-${AWS::AccountId}"
  },
}
```

Or use it to generate Arn's, for example for [Step Functions](https://www.npmjs.com/package/serverless-step-functions):

```yaml
service: foobar-handler

plugins:
  - serverless-pseudo-parameters

functions:
  foobar-baz:
    handler: foo.handler

stepFunctions:
  stateMachines:
    foobar:
      definition:
        Comment: "Foo!"
        StartAt: bar
        States:
          bar:
            Type: Task
            Resource: "arn:aws:lambda:#{AWS::Region}:#{AWS::AccountId}:function:${self:service}-${opt:stage}-foobar-baz"
            End: true
```

The plugin also automatically replace _hardcoded_ region in `serverless.yml`. This feature can be disabled using:

```yaml
custom:
    pseudoParameters:
        skipRegionReplace: true
```
