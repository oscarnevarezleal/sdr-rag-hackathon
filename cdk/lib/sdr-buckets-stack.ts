import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class SdrBucketsStack extends cdk.Stack {
  public readonly incomingBucket: s3.Bucket;
  public readonly organizedBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.incomingBucket = new s3.Bucket(this, 'IncomingBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT for production
      autoDeleteObjects: true, // NOT for production
    });

    this.organizedBucket = new s3.Bucket(this, 'OrganizedBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT for production
      autoDeleteObjects: true, // NOT for production
    });

    new cdk.CfnOutput(this, 'IncomingBucketName', {
      value: this.incomingBucket.bucketName,
      description: 'Name of the S3 bucket for incoming documents',
    });

    new cdk.CfnOutput(this, 'OrganizedBucketName', {
      value: this.organizedBucket.bucketName,
      description: 'Name of the S3 bucket for organized documents',
    });
  }
}
