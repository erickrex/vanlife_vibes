#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { VanlifeInfraStack } from '../lib/vanlife-infra-stack';

const app = new cdk.App();

const appName = app.node.tryGetContext('appName') ?? 'vanlifevibes';
const environmentName = app.node.tryGetContext('environmentName') ?? 'prod';
const awsRegion = app.node.tryGetContext('awsRegion') ?? process.env.CDK_DEFAULT_REGION ?? 'us-east-1';

const ebSolutionStackName = app.node.tryGetContext('ebSolutionStackName');
if (!ebSolutionStackName) {
  throw new Error(
    'Missing context "ebSolutionStackName". Example: -c ebSolutionStackName="64bit Amazon Linux 2023 v4.3.5 running Docker"',
  );
}

new VanlifeInfraStack(app, 'VanlifeInfraStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: awsRegion,
  },
  appName,
  environmentName,
  ebSolutionStackName,
  customDomain: app.node.tryGetContext('customDomain') ?? '',
  acmCertificateArn: app.node.tryGetContext('acmCertificateArn') ?? '',
  corsAllowedOrigins: app.node.tryGetContext('corsAllowedOrigins') ?? '',
  dbName: app.node.tryGetContext('dbName') ?? 'vanlifevibes',
  dbUsername: app.node.tryGetContext('dbUsername') ?? 'vanlifevibes_admin',
  dbInstanceType: app.node.tryGetContext('dbInstanceType') ?? 't4g.micro',
  redisNodeType: app.node.tryGetContext('redisNodeType') ?? 'cache.t4g.micro',
  instanceType: app.node.tryGetContext('instanceType') ?? 't3.small',
  singleInstance: (app.node.tryGetContext('singleInstance') ?? 'false').toString().toLowerCase() === 'true',
  revenuecatWebhookSecret: app.node.tryGetContext('revenuecatWebhookSecret') ?? '',
  emailHostUser: app.node.tryGetContext('emailHostUser') ?? '',
  emailHostPassword: app.node.tryGetContext('emailHostPassword') ?? '',
});
