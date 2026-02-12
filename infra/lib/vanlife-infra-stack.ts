import * as path from 'node:path';
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
} from 'aws-cdk-lib';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Asset } from 'aws-cdk-lib/aws-s3-assets';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as elasticbeanstalk from 'aws-cdk-lib/aws-elasticbeanstalk';
import { Construct } from 'constructs';

export interface VanlifeInfraStackProps extends StackProps {
  appName: string;
  environmentName: string;
  ebSolutionStackName: string;
  customDomain: string;
  acmCertificateArn: string;
  corsAllowedOrigins: string;
  dbName: string;
  dbUsername: string;
  dbInstanceType: string;
  redisNodeType: string;
  instanceType: string;
  singleInstance: boolean;
  revenuecatWebhookSecret: string;
  emailHostUser: string;
  emailHostPassword: string;
}

export class VanlifeInfraStack extends Stack {
  constructor(scope: Construct, id: string, props: VanlifeInfraStackProps) {
    super(scope, id, props);

    const namePrefix = `${props.appName}-${props.environmentName}`;

    const vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr('10.42.0.0/16'),
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'app',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'data',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    const appSecurityGroup = new ec2.SecurityGroup(this, 'AppSecurityGroup', {
      vpc,
      allowAllOutbound: true,
      description: 'Security group for Elastic Beanstalk EC2 instances',
      securityGroupName: `${namePrefix}-app-sg`,
    });

    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc,
      allowAllOutbound: false,
      description: 'Security group for PostgreSQL RDS instance',
      securityGroupName: `${namePrefix}-db-sg`,
    });
    dbSecurityGroup.addIngressRule(appSecurityGroup, ec2.Port.tcp(5432), 'Allow app to PostgreSQL');

    const redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc,
      allowAllOutbound: false,
      description: 'Security group for Redis cache',
      securityGroupName: `${namePrefix}-redis-sg`,
    });
    redisSecurityGroup.addIngressRule(appSecurityGroup, ec2.Port.tcp(6379), 'Allow app to Redis');

    const uploadsBucket = new Bucket(this, 'AssetsBucket', {
      bucketName: `${namePrefix}-assets-${this.account}`.toLowerCase(),
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });

    const dbCredentialsSecret = new secretsmanager.Secret(this, 'DbCredentialsSecret', {
      secretName: `${namePrefix}/db-credentials`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: props.dbUsername }),
        generateStringKey: 'password',
        excludePunctuation: true,
      },
    });

    const djangoSecretKey = new secretsmanager.Secret(this, 'DjangoSecretKey', {
      secretName: `${namePrefix}/django-secret-key`,
      generateSecretString: {
        passwordLength: 64,
        excludePunctuation: false,
      },
    });

    const dbInstance = new rds.DatabaseInstance(this, 'Postgres', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSecurityGroup],
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_4,
      }),
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      storageEncrypted: true,
      backupRetention: Duration.days(7),
      deletionProtection: true,
      credentials: rds.Credentials.fromSecret(dbCredentialsSecret),
      databaseName: props.dbName,
      instanceType: new ec2.InstanceType(props.dbInstanceType),
      publiclyAccessible: false,
      multiAz: false,
      removalPolicy: RemovalPolicy.SNAPSHOT,
    });

    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for Redis cache',
      subnetIds: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds,
      cacheSubnetGroupName: `${namePrefix}-redis-subnet-group`,
    });

    const redisCluster = new elasticache.CfnCacheCluster(this, 'RedisCluster', {
      cacheNodeType: props.redisNodeType,
      engine: 'redis',
      numCacheNodes: 1,
      clusterName: `${namePrefix}-redis`,
      vpcSecurityGroupIds: [redisSecurityGroup.securityGroupId],
      cacheSubnetGroupName: redisSubnetGroup.cacheSubnetGroupName,
      autoMinorVersionUpgrade: true,
    });
    redisCluster.addDependency(redisSubnetGroup);

    const ebEc2Role = new iam.Role(this, 'EbEc2Role', {
      roleName: `${namePrefix}-eb-ec2-role`,
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSElasticBeanstalkWebTier'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSElasticBeanstalkWorkerTier'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSElasticBeanstalkMulticontainerDocker'),
      ],
    });
    uploadsBucket.grantReadWrite(ebEc2Role);
    dbCredentialsSecret.grantRead(ebEc2Role);
    djangoSecretKey.grantRead(ebEc2Role);

    const ebServiceRole = new iam.Role(this, 'EbServiceRole', {
      roleName: `${namePrefix}-eb-service-role`,
      assumedBy: new iam.ServicePrincipal('elasticbeanstalk.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSElasticBeanstalkEnhancedHealth'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSElasticBeanstalkService'),
      ],
    });

    const ebInstanceProfile = new iam.CfnInstanceProfile(this, 'EbInstanceProfile', {
      instanceProfileName: `${namePrefix}-eb-instance-profile`,
      roles: [ebEc2Role.roleName],
    });

    const ebApplication = new elasticbeanstalk.CfnApplication(this, 'EbApplication', {
      applicationName: props.appName,
      description: 'VanlifeVibes Django backend',
    });

    const sourceBundleAsset = new Asset(this, 'SourceBundleAsset', {
      path: path.resolve(__dirname, '..', '..', '..'),
      exclude: [
        '.git',
        '.venv',
        '.pytest_cache',
        '.ruff_cache',
        '__pycache__',
        '.ebextensions',
        'mobile-app/node_modules',
        'mobile-app/.expo',
        'infra/node_modules',
        'infra/cdk.out',
      ],
    });

    const appVersion = new elasticbeanstalk.CfnApplicationVersion(
      this,
      `EbApplicationVersion${sourceBundleAsset.assetHash.slice(0, 10)}`,
      {
        applicationName: ebApplication.applicationName || props.appName,
        sourceBundle: {
          s3Bucket: sourceBundleAsset.s3BucketName,
          s3Key: sourceBundleAsset.s3ObjectKey,
        },
      },
    );
    appVersion.addDependency(ebApplication);

    const allowedHosts = props.customDomain
      ? `${props.customDomain},www.${props.customDomain}`
      : 'localhost,127.0.0.1';

    const corsAllowedOrigins = props.corsAllowedOrigins
      ? props.corsAllowedOrigins
      : props.customDomain
        ? `https://${props.customDomain},https://www.${props.customDomain}`
        : 'http://localhost:8081,http://localhost:19006';

    const optionSettings: elasticbeanstalk.CfnEnvironment.OptionSettingProperty[] = [
      { namespace: 'aws:autoscaling:launchconfiguration', optionName: 'IamInstanceProfile', value: ebInstanceProfile.ref },
      { namespace: 'aws:autoscaling:launchconfiguration', optionName: 'InstanceType', value: props.instanceType },
      { namespace: 'aws:elasticbeanstalk:environment', optionName: 'EnvironmentType', value: props.singleInstance ? 'SingleInstance' : 'LoadBalanced' },
      { namespace: 'aws:elasticbeanstalk:environment', optionName: 'ServiceRole', value: ebServiceRole.roleName },
      { namespace: 'aws:ec2:vpc', optionName: 'VPCId', value: vpc.vpcId },
      {
        namespace: 'aws:ec2:vpc',
        optionName: 'Subnets',
        value: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }).subnetIds.join(','),
      },
      { namespace: 'aws:ec2:vpc', optionName: 'AssociatePublicIpAddress', value: 'true' },
      { namespace: 'aws:autoscaling:launchconfiguration', optionName: 'SecurityGroups', value: appSecurityGroup.securityGroupId },
      { namespace: 'aws:elasticbeanstalk:application:environment', optionName: 'DJANGO_ENV', value: 'production' },
      { namespace: 'aws:elasticbeanstalk:application:environment', optionName: 'DJANGO_SETTINGS_MODULE', value: 'vanlifevibes.settings' },
      {
        namespace: 'aws:elasticbeanstalk:application:environment',
        optionName: 'SECRET_KEY',
        value: djangoSecretKey.secretValue.toString(),
      },
      { namespace: 'aws:elasticbeanstalk:application:environment', optionName: 'ALLOWED_HOSTS', value: allowedHosts },
      { namespace: 'aws:elasticbeanstalk:application:environment', optionName: 'DB_NAME', value: props.dbName },
      { namespace: 'aws:elasticbeanstalk:application:environment', optionName: 'DB_USER', value: props.dbUsername },
      {
        namespace: 'aws:elasticbeanstalk:application:environment',
        optionName: 'DB_PASSWORD',
        value: dbCredentialsSecret.secretValueFromJson('password').toString(),
      },
      {
        namespace: 'aws:elasticbeanstalk:application:environment',
        optionName: 'DB_HOST',
        value: dbInstance.dbInstanceEndpointAddress,
      },
      {
        namespace: 'aws:elasticbeanstalk:application:environment',
        optionName: 'DB_PORT',
        value: dbInstance.dbInstanceEndpointPort,
      },
      { namespace: 'aws:elasticbeanstalk:application:environment', optionName: 'USE_S3_STORAGE', value: 'True' },
      {
        namespace: 'aws:elasticbeanstalk:application:environment',
        optionName: 'AWS_STORAGE_BUCKET_NAME',
        value: uploadsBucket.bucketName,
      },
      {
        namespace: 'aws:elasticbeanstalk:application:environment',
        optionName: 'AWS_S3_REGION_NAME',
        value: this.region,
      },
      {
        namespace: 'aws:elasticbeanstalk:application:environment',
        optionName: 'REDIS_URL',
        value: `redis://${redisCluster.attrRedisEndpointAddress}:6379`,
      },
      {
        namespace: 'aws:elasticbeanstalk:application:environment',
        optionName: 'CORS_ALLOWED_ORIGINS',
        value: corsAllowedOrigins,
      },
      {
        namespace: 'aws:elasticbeanstalk:application:environment',
        optionName: 'EMAIL_HOST',
        value: `email-smtp.${this.region}.amazonaws.com`,
      },
      {
        namespace: 'aws:elasticbeanstalk:application:environment',
        optionName: 'EMAIL_HOST_USER',
        value: props.emailHostUser,
      },
      {
        namespace: 'aws:elasticbeanstalk:application:environment',
        optionName: 'EMAIL_HOST_PASSWORD',
        value: props.emailHostPassword,
      },
      {
        namespace: 'aws:elasticbeanstalk:application:environment',
        optionName: 'DEFAULT_FROM_EMAIL',
        value: props.customDomain ? `noreply@${props.customDomain}` : 'noreply@vanlifevibes.com',
      },
      {
        namespace: 'aws:elasticbeanstalk:application:environment',
        optionName: 'REVENUECAT_WEBHOOK_SECRET',
        value: props.revenuecatWebhookSecret,
      },
      {
        namespace: 'aws:elasticbeanstalk:environment:process:default',
        optionName: 'HealthCheckPath',
        value: '/api/v1/health/',
      },
      {
        namespace: 'aws:elasticbeanstalk:environment:process:default',
        optionName: 'MatcherHTTPCode',
        value: '200',
      },
      {
        namespace: 'aws:elasticbeanstalk:environment:process:default',
        optionName: 'StickinessEnabled',
        value: 'true',
      },
      {
        namespace: 'aws:elasticbeanstalk:environment:process:default',
        optionName: 'StickinessLBCookieDuration',
        value: '86400',
      },
    ];

    if (!props.singleInstance) {
      optionSettings.push(
        { namespace: 'aws:elasticbeanstalk:environment', optionName: 'LoadBalancerType', value: 'application' },
        {
          namespace: 'aws:ec2:vpc',
          optionName: 'ELBSubnets',
          value: vpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC }).subnetIds.join(','),
        },
      );
    }

    if (props.acmCertificateArn) {
      optionSettings.push(
        {
          namespace: 'aws:elbv2:listener:443',
          optionName: 'Protocol',
          value: 'HTTPS',
        },
        {
          namespace: 'aws:elbv2:listener:443',
          optionName: 'SSLCertificateArns',
          value: props.acmCertificateArn,
        },
        {
          namespace: 'aws:elbv2:listener:443',
          optionName: 'DefaultProcess',
          value: 'default',
        },
      );
    }

    const ebEnvironment = new elasticbeanstalk.CfnEnvironment(this, 'EbEnvironment', {
      applicationName: ebApplication.applicationName || props.appName,
      environmentName: `${namePrefix}-env`,
      solutionStackName: props.ebSolutionStackName,
      optionSettings,
      versionLabel: appVersion.ref,
      cnamePrefix: `${props.appName}-${props.environmentName}`,
    });
    ebEnvironment.addDependency(appVersion);

    new CfnOutput(this, 'ElasticBeanstalkUrl', {
      value: `${props.acmCertificateArn ? 'https' : 'http'}://${ebEnvironment.attrEndpointUrl}`,
    });

    new CfnOutput(this, 'AssetsBucketName', {
      value: uploadsBucket.bucketName,
    });

    new CfnOutput(this, 'DatabaseEndpoint', {
      value: dbInstance.dbInstanceEndpointAddress,
    });

    new CfnOutput(this, 'RedisEndpoint', {
      value: redisCluster.attrRedisEndpointAddress,
    });

    new CfnOutput(this, 'DbCredentialsSecretArn', {
      value: dbCredentialsSecret.secretArn,
    });

    new CfnOutput(this, 'DjangoSecretKeySecretArn', {
      value: djangoSecretKey.secretArn,
    });
  }
}
