
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';

export class SdrPostgresStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly dbSecret: secretsmanager.Secret;
  public readonly dbInstance: rds.DatabaseInstance;
  public readonly dbSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Create a new VPC for our database and lambdas
    this.vpc = new ec2.Vpc(this, 'SdrVpc', {
      maxAzs: 2,
      natGateways: 1,
    });

    // 2. Create a security group for the database
    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc: this.vpc,
      description: 'Allow inbound traffic to the database',
    });

    // 3. Create a secret for the database credentials
    this.dbSecret = new secretsmanager.Secret(this, 'DbCredentialsSecret', {
      secretName: 'sdr/db-credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        excludePunctuation: true,
        includeSpace: false,
        generateStringKey: 'password',
      },
    });

    // 4. Create the RDS PostgreSQL cluster with pgvector
    this.dbInstance = new rds.DatabaseInstance(this, 'SdrDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_17_4,
      }),
      credentials: rds.Credentials.fromSecret(this.dbSecret),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [this.dbSecurityGroup],
      databaseName: 'sdr',
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT for production
    });

    // 5. Add an ingress rule to the security group to allow connections from within the VPC
    this.dbSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'Allow inbound from VPC'
    );

    // Custom resource to enable pgvector extension
    const pgVectorEnablerLambda = new lambda.DockerImageFunction(this, 'PgVectorEnablerLambda', {
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, '../../lambda/pgvector-enabler')
      ),
      environment: {
        DB_SECRET_ARN: this.dbSecret.secretArn,
        DB_INSTANCE_ENDPOINT: this.dbInstance.instanceEndpoint.hostname,
        DB_NAME: 'sdr',
      },
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [this.dbSecurityGroup],
    });

    pgVectorEnablerLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [this.dbSecret.secretArn],
    }));
    pgVectorEnablerLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds-db:connect'],
      resources: [this.dbInstance.instanceArn],
    }));

    new cdk.CfnOutput(this, 'PgVectorEnablerLambdaArn', {
      value: pgVectorEnablerLambda.functionArn,
    });

    // 6. Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
    });
    new cdk.CfnOutput(this, 'DbInstanceEndpoint', {
      value: this.dbInstance.instanceEndpoint.hostname,
    });
    new cdk.CfnOutput(this, 'DbSecretArn', {
      value: this.dbSecret.secretArn,
    });
  }
}
