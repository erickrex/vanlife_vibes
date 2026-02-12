# Infrastructure (AWS CDK, TypeScript)

This folder provisions AWS infrastructure for the VanlifeVibes backend using AWS CDK (TypeScript).

## What It Creates

- VPC with public/app/data subnets
- Elastic Beanstalk application + environment (Docker platform)
- RDS PostgreSQL instance (private subnet)
- ElastiCache Redis cluster (private subnet)
- S3 bucket for static/media files
- IAM roles and instance profile for Elastic Beanstalk
- Secrets Manager secrets for DB password and Django `SECRET_KEY`

## Prerequisites

- AWS CLI configured for your target account
- Node.js 20+
- CDK bootstrap done at least once per account/region

## Install

```bash
cd /Users/erickrea/Documents/reference_code/vanlife_vibes/infra
npm install
```

## Deploy

Set required context values. The only hard-required one is `ebSolutionStackName`.

```bash
cd /Users/erickrea/Documents/reference_code/vanlife_vibes/infra

npx cdk deploy \
  -c awsRegion=us-east-1 \
  -c ebSolutionStackName="64bit Amazon Linux 2023 v4.3.5 running Docker" \
  -c appName=vanlifevibes \
  -c environmentName=prod \
  -c customDomain=api.yourdomain.com \
  -c acmCertificateArn=arn:aws:acm:us-east-1:123456789012:certificate/xxxx \
  -c corsAllowedOrigins="https://yourdomain.com,https://www.yourdomain.com" \
  -c emailHostUser="your-ses-smtp-username" \
  -c emailHostPassword="your-ses-smtp-password" \
  -c revenuecatWebhookSecret="your-revenuecat-secret"
```

If you do not have a custom domain/cert yet, omit `customDomain` and `acmCertificateArn`.

To use a single-instance environment instead of load-balanced:

```bash
npx cdk deploy -c singleInstance=true ...
```

## Notes

- App code is packaged from the repository root and used as the EB application version source bundle.
- The stack injects environment variables expected by `vanlifevibes/settings.py`.
- `.ebextensions/*` is intentionally excluded from the CDK source bundle because this stack sets EB options directly.
