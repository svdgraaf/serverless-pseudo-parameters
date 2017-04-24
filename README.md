Serverless AWS Pseudo Parameters
--------------------------------

Currently, it's impossible (or at least, very hard) to use the CloudFormation Pseudo Parameters in your `serverless.yml`. This plugin fixes that.
You can now use #{AWS::AccountId} etc in any of your config strings, and this plugin replaces those values with the proper pseudo parameter fn::sub function.



Examples
--------
For example, this configuration will create a bucket with your account id appended to the bucket name:

```
service: users-bucket-thingy

plugins:
  - serverless-aws-pseudo-parameters

functions:
  users:
    handler: users.handler
    events:
      - s3:
          bucket: photos-#{AWS::AccountId}
          event: s3:ObjectRemoved:*
```

Or is it to generate Arn's for Step Functions:

```
service: foobar-handler

plugins:
  - serverless-aws-pseudo-parameters

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

The output in the cloudformation template will look something like this:

```
"Type": "AWS::S3::Bucket",
"Properties": {
  "BucketName": {
    "Fn::Sub": "photos-${AWS::AccountId}"
  },
}
```
