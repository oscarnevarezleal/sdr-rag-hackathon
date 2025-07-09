import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Define Core Resources
    const incomingBucket = new s3.Bucket(this, 'IncomingBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT for production
      autoDeleteObjects: true, // NOT for production
    });

    const organizedBucket = new s3.Bucket(this, 'OrganizedBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT for production
      autoDeleteObjects: true, // NOT for production
    });

    const documentTable = new dynamodb.Table(this, 'DocumentTable', {
      partitionKey: { name: 'document_id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT for production
    });

    const notificationTopic = new sns.Topic(this, 'NotificationTopic', {
      displayName: 'Document Processing Notifications',
    });

    // 2. Define all Lambda Functions (without cross-references initially)
    const uploadHandler = new lambda.DockerImageFunction(this, 'UploadHandler',
      {
        code: lambda.DockerImageCode.fromImageAsset(
          path.join(__dirname, '../../lambda/upload-handler')
        ),
        environment: {
          BUCKET_NAME: incomingBucket.bucketName,
        },
      }
    );

    const router = new lambda.DockerImageFunction(this, 'Router', {
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, '../../lambda/router')
      ),
      environment: {
        ROUTED_BUCKET_NAME: organizedBucket.bucketName,
        DYNAMODB_TABLE_NAME: documentTable.tableName,
        SNS_TOPIC_ARN: notificationTopic.topicArn,
        ACCOUNTING_EMAIL: "accounting@example.com", // Replace with actual email
        LEGAL_EMAIL: "legal@example.com", // Replace with actual email
      },
    });

    const extractor = new lambda.DockerImageFunction(this, 'Extractor', {
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, '../../lambda/extractor')
      ),
      environment: {
        BEDROCK_MODEL_ID: "anthropic.claude-v2",
      },
    });

    const classifier = new lambda.DockerImageFunction(this, 'Classifier', {
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, '../../lambda/classifier')
      ),
      environment: {
        BEDROCK_MODEL_ID: "anthropic.claude-v2",
      },
    });

    // 3. Grant Permissions

    // Upload Handler permissions
    incomingBucket.grantWrite(uploadHandler);

    // Router permissions
    incomingBucket.grantRead(router); // To read from incoming
    organizedBucket.grantWrite(router); // To write to organized
    documentTable.grantWriteData(router); // To write metadata
    notificationTopic.grantPublish(router); // To send SNS notifications
    router.addToRolePolicy(new iam.PolicyStatement({
      actions: ["ses:SendEmail", "ses:SendRawEmail"],
      resources: ["*"], // SES permissions are often global or require specific ARNs
    }));

    // Extractor permissions
    incomingBucket.grantRead(extractor);
    extractor.addToRolePolicy(new iam.PolicyStatement({
      actions: ["bedrock:InvokeModel"],
      resources: ["arn:aws:bedrock:*:*:model/anthropic.claude-v2"],
    }));

    // Classifier permissions
    incomingBucket.grantRead(classifier);
    classifier.addToRolePolicy(new iam.PolicyStatement({
      actions: ["bedrock:InvokeModel"],
      resources: ["arn:aws:bedrock:*:*:model/anthropic.claude-v2"],
    }));

    // 4. Configure Cross-Lambda Environment Variables and Invoke Permissions
    classifier.addEnvironment('EXTRACTOR_LAMBDA_ARN', extractor.functionArn);
    classifier.grantInvoke(extractor); // Classifier invokes Extractor

    extractor.addEnvironment('ROUTER_LAMBDA_ARN', router.functionArn);
    extractor.grantInvoke(router); // Extractor invokes Router

    // 5. Add Triggers

    // Create and configure the Lambda Function URL for uploadHandler
    const functionUrl = uploadHandler.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE, // Or AWS_IAM for authenticated requests
      cors: {
        allowedOrigins: ['*'],
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: ['x-file-name'],
      },
    });

    // Add S3 trigger to the classifier Lambda
    incomingBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(classifier),
      { prefix: 'incoming/' }
    );

    // 6. Outputs
    new cdk.CfnOutput(this, 'UploadUrl', {
      value: functionUrl.url,
    });
    new cdk.CfnOutput(this, 'IncomingBucketName', {
      value: incomingBucket.bucketName,
    });
    new cdk.CfnOutput(this, 'OrganizedBucketName', {
      value: organizedBucket.bucketName,
    });
    new cdk.CfnOutput(this, 'ClassifierLambdaArn', {
      value: classifier.functionArn,
    });
    new cdk.CfnOutput(this, 'ExtractorLambdaArn', {
      value: extractor.functionArn,
    });
    new cdk.CfnOutput(this, 'RouterLambdaArn', {
      value: router.functionArn,
    });
  }
}
