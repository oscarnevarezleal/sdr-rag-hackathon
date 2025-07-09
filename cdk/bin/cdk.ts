#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SdrBucketsStack } from '../lib/sdr-buckets-stack';
import { SdrDatabaseStack } from '../lib/sdr-database-stack';
import { SdrPostgresStack } from '../lib/sdr-postgres-stack';
import { SdrLambdasStack } from '../lib/sdr-lambdas-stack';
import { SdrChatStack } from '../lib/sdr-chat-stack';

const app = new cdk.App();

const bucketsStack = new SdrBucketsStack(app, 'SdrBucketsStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

const databaseStack = new SdrDatabaseStack(app, 'SdrDatabaseStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

const postgresStack = new SdrPostgresStack(app, 'SdrPostgresStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

const chatStack = new SdrChatStack(app, 'SdrChatStack', {
  vpc: postgresStack.vpc,
  dbInstance: postgresStack.dbInstance,
  dbSecret: postgresStack.dbSecret,
  dbSecurityGroup: postgresStack.dbSecurityGroup,
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

new SdrLambdasStack(app, 'SdrLambdasStack', {
  incomingBucketName: bucketsStack.incomingBucket.bucketName,
  organizedBucketName: bucketsStack.organizedBucket.bucketName,
  documentTableName: databaseStack.documentTable.tableName,
  notificationTopicArn: databaseStack.notificationTopic.topicArn,
  embeddingGeneratorLambdaArn: chatStack.embeddingGeneratorLambdaArn,
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
