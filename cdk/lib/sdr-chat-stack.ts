
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

interface SdrChatStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  dbInstance: rds.IDatabaseInstance;
  dbSecret: secretsmanager.ISecret;
  dbSecurityGroup: ec2.ISecurityGroup;
}

const CLAUDE_MODEL_ID = 'anthropic.claude-3-5-sonnet-20241022-v2:0'
const AWS_EMBEDDING_MODEL_ID = 'amazon.titan-embed-text-v2:0'

export class SdrChatStack extends cdk.Stack {
  public readonly embeddingGeneratorLambdaArn: string;
  constructor(scope: Construct, id: string, props: SdrChatStackProps) {
    super(scope, id, props);

    // 1. Define the EmbeddingGenerator Lambda
    const embeddingGenerator = new lambda.DockerImageFunction(this, 'EmbeddingGenerator', {
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, '../../lambda/embedding-generator')
      ),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.dbSecurityGroup],
      environment: {
        DB_SECRET_ARN: props.dbSecret.secretArn,
        DB_CLUSTER_ENDPOINT: props.dbInstance.instanceEndpoint.hostname,
        BEDROCK_MODEL_ID: AWS_EMBEDDING_MODEL_ID,
      },
    });

    // 2. Define the ChatQueryHandler Lambda
    const chatQueryHandler = new lambda.DockerImageFunction(this, 'ChatQueryHandler', {
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, '../../lambda/chat-query-handler')
      ),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.dbSecurityGroup],
      environment: {
        DB_SECRET_ARN: props.dbSecret.secretArn,
        DB_CLUSTER_ENDPOINT: props.dbInstance.instanceEndpoint.hostname,
        BEDROCK_MODEL_ID: CLAUDE_MODEL_ID,
        TITAN_BEDROCK_MODEL_ID: AWS_EMBEDDING_MODEL_ID,
      },
      timeout: cdk.Duration.seconds(10),
    });

    // 3. Grant database access to the lambdas
    props.dbSecret.grantRead(embeddingGenerator);
    props.dbSecret.grantRead(chatQueryHandler);

    // Grant rds-db:connect permission to the lambdas
    embeddingGenerator.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds-db:connect'],
      resources: [props.dbInstance.instanceArn],
    }));
    chatQueryHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds-db:connect'],
      resources: [props.dbInstance.instanceArn],
    }));

    // 4. Grant Bedrock permissions
    embeddingGenerator.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['arn:aws:bedrock:*:*:foundation-model/' + AWS_EMBEDDING_MODEL_ID],
    }));
    chatQueryHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: [
        'arn:aws:bedrock:*:*:foundation-model/' + CLAUDE_MODEL_ID,
        'arn:aws:bedrock:*:*:foundation-model/' + AWS_EMBEDDING_MODEL_ID
      ],
    }));

    // 5. Create the API Gateway
    const api = new apigateway.LambdaRestApi(this, 'SdrChatApi', {
      handler: chatQueryHandler,
      proxy: false,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
      },
    });

    const chat = api.root.addResource('chat');
    chat.addMethod('POST');

    const conversation = chat.addResource('{conversation_id}');
    conversation.addMethod('POST');

    // 6. Outputs
    this.embeddingGeneratorLambdaArn = embeddingGenerator.functionArn;

    new cdk.CfnOutput(this, 'ChatApiUrl', {
      value: api.url,
    });
  }
}
