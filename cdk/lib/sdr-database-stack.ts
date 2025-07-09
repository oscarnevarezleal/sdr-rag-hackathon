import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';

export class SdrDatabaseStack extends cdk.Stack {
  public readonly documentTable: dynamodb.Table;
  public readonly notificationTopic: sns.Topic;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.documentTable = new dynamodb.Table(this, 'DocumentTable', {
      partitionKey: { name: 'document_id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT for production
    });

    this.notificationTopic = new sns.Topic(this, 'NotificationTopic', {
      displayName: 'Document Processing Notifications',
    });

    new cdk.CfnOutput(this, 'DocumentTableName', {
      value: this.documentTable.tableName,
      description: 'Name of the DynamoDB table for document metadata',
    });

    new cdk.CfnOutput(this, 'NotificationTopicArn', {
      value: this.notificationTopic.topicArn,
      description: 'ARN of the SNS topic for notifications',
    });
  }
}
