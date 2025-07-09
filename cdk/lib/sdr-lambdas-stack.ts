import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';

interface SdrLambdasStackProps extends cdk.StackProps {
  incomingBucketName: string;
  organizedBucketName: string;
  documentTableName: string;
  notificationTopicArn: string;
  embeddingGeneratorLambdaArn: string;
}

const AWS_EXTRACTOR_MODEL_ID = 'anthropic.claude-instant-v1'

export class SdrLambdasStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SdrLambdasStackProps) {
    super(scope, id, props);

    const incomingBucket = s3.Bucket.fromBucketName(this, 'IncomingBucket', props.incomingBucketName);
    const organizedBucket = s3.Bucket.fromBucketName(this, 'OrganizedBucket', props.organizedBucketName);

    // 1. Define all Lambda Functions (without cross-references initially)
    // 2. Define all Lambda Functions (without cross-references initially)
    const uploadHandlerRole = new iam.Role(this, 'UploadHandlerRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
    });

    const uploadHandler = new lambda.DockerImageFunction(this, 'UploadHandler',
      {
        code: lambda.DockerImageCode.fromImageAsset(
          path.join(__dirname, '../../lambda/upload-handler')
        ),
        environment: {
          INCOMING_BUCKET_NAME: incomingBucket.bucketName,
        },
        role: uploadHandlerRole,
      }
    );

    const routerRole = new iam.Role(this, 'RouterRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
    });

    const router = new lambda.DockerImageFunction(this, 'Router', {
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, '../../lambda/router')
      ),
      environment: {
        ROUTED_BUCKET_NAME: organizedBucket.bucketName,
        DYNAMODB_TABLE_NAME: props.documentTableName,
        SNS_TOPIC_ARN: props.notificationTopicArn,
        ACCOUNTING_EMAIL: "accounting@example.com", // Replace with actual email
        LEGAL_EMAIL: "legal@example.com", // Replace with actual email
      },
      role: routerRole,
    });

    const extractorRole = new iam.Role(this, 'ExtractorRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
    });

    const extractor = new lambda.DockerImageFunction(this, 'Extractor', {
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, '../../lambda/extractor')
      ),
      environment: {
        BEDROCK_MODEL_ID: AWS_EXTRACTOR_MODEL_ID,
        EMBEDDING_GENERATOR_LAMBDA_ARN: props.embeddingGeneratorLambdaArn,
      },
      role: extractorRole,
      timeout: cdk.Duration.seconds(10),
    });

    const classifierRole = new iam.Role(this, 'ClassifierRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
    });

    const classifier = new lambda.DockerImageFunction(this, 'Classifier', {
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, '../../lambda/classifier')
      ),
      environment: {
        BEDROCK_MODEL_ID: AWS_EXTRACTOR_MODEL_ID
      },
      role: classifierRole,
      timeout: cdk.Duration.seconds(10),
    });

    // 3. Grant Permissions

    // Upload Handler permissions
    uploadHandlerRole.addToPolicy(new iam.PolicyStatement({
      actions: ["s3:PutObject", "s3:GetObject"],
      resources: [incomingBucket.bucketArn + "/*"],
    }));

    // Router permissions
    routerRole.addToPolicy(new iam.PolicyStatement({
      actions: ["s3:GetObject", "s3:DeleteObject", "s3:ListBucket"],
      resources: [incomingBucket.bucketArn, incomingBucket.bucketArn + "/*"],
    }));
    routerRole.addToPolicy(new iam.PolicyStatement({
      actions: ["s3:PutObject"],
      resources: [organizedBucket.bucketArn + "/*"],
    }));
    routerRole.addToPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:PutItem"],
      resources: [`arn:aws:dynamodb:${this.region}:${this.account}:table/${props.documentTableName}`],
    }));
    routerRole.addToPolicy(new iam.PolicyStatement({
      actions: ["sns:Publish"],
      resources: [props.notificationTopicArn],
    }));
    routerRole.addToPolicy(new iam.PolicyStatement({
      actions: ["ses:SendEmail", "ses:SendRawEmail"],
      resources: ["*"], // SES permissions are often global or require specific ARNs
    }));

    // Extractor permissions
    extractorRole.addToPolicy(new iam.PolicyStatement({
      actions: ["s3:GetObject", "s3:ListBucket"],
      resources: [incomingBucket.bucketArn, incomingBucket.bucketArn + "/*"],
    }));
    extractorRole.addToPolicy(new iam.PolicyStatement({
      actions: ["bedrock:InvokeModel"],
      resources: ["arn:aws:bedrock:*:*:foundation-model/" + AWS_EXTRACTOR_MODEL_ID],
    }));
    extractorRole.addToPolicy(new iam.PolicyStatement({
      actions: ["lambda:InvokeFunction"],
      resources: [router.functionArn, props.embeddingGeneratorLambdaArn],
    }));

    // Classifier permissions
    classifierRole.addToPolicy(new iam.PolicyStatement({
      actions: ["s3:GetObject"],
      resources: [incomingBucket.bucketArn + "/*"],
    }));
    classifierRole.addToPolicy(new iam.PolicyStatement({
      actions: ["bedrock:InvokeModel"],
      resources: ["arn:aws:bedrock:*:*:foundation-model/" + AWS_EXTRACTOR_MODEL_ID],
    }));
    classifierRole.addToPolicy(new iam.PolicyStatement({
      actions: ["lambda:InvokeFunction"],
      resources: [extractor.functionArn],
    }));

    // 3. Configure Cross-Lambda Environment Variables
    classifier.addEnvironment('EXTRACTOR_LAMBDA_ARN', extractor.functionArn);
    extractor.addEnvironment('ROUTER_LAMBDA_ARN', router.functionArn);

    // 4. Add Triggers

    // Create and configure the Lambda Function URL for uploadHandler
    const functionUrl = uploadHandler.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE, // Or AWS_IAM for authenticated requests
      cors: {
        allowedOrigins: ['*'],
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: ['*'],
        allowCredentials: false,
        maxAge: cdk.Duration.seconds(300),
      },
    });

    // Add S3 trigger to the classifier Lambda
    incomingBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(classifier),
      { prefix: 'incoming/' }
    );

    // 5. Outputs
    new cdk.CfnOutput(this, 'UploadUrl', {
      value: functionUrl.url,
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
