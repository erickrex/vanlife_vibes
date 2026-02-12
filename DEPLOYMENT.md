# Deploying VanlifeVibes to AWS

VanlifeVibes uses AWS CDK to provision and deploy all infrastructure as code. A single `cdk deploy` command creates the VPC, database, cache, S3 bucket, and Elastic Beanstalk environment, then deploys the Django backend as a Docker container.

## Architecture Overview

```
Internet
  │
  ▼
Elastic Beanstalk (Docker on EC2)
  ├── Django / Daphne (HTTP + WebSocket on port 8000)
  ├── nginx reverse proxy (port 80 → 8000)
  │
  ├──► RDS PostgreSQL 16.6 (private subnet)
  ├──► ElastiCache Redis (private subnet, for Django Channels)
  └──► S3 Bucket (media uploads + static files)
```

Resources created by CDK:
- VPC with public, private, and isolated subnets (2 AZs)
- RDS PostgreSQL 16.6 (`t4g.micro` default)
- ElastiCache Redis (`cache.t4g.micro` default)
- S3 bucket for media/static assets
- Secrets Manager secrets for DB credentials and Django secret key
- Elastic Beanstalk application + environment (Docker platform)
- IAM roles and security groups

## Prerequisites

1. **AWS CLI** installed and configured with credentials
2. **Node.js** (for CDK CLI)
3. **AWS CDK CLI**: `npm install -g aws-cdk`
4. **AWS Account** with admin-level permissions

## Initial Setup

### 1. Configure AWS Credentials

For IAM user credentials:
```bash
aws configure
# Enter Access Key ID, Secret Access Key, region (us-east-2), output format (json)
```

Verify:
```bash
aws sts get-caller-identity
```

### 2. Bootstrap CDK (one-time per account/region)

```bash
cd infra
npx cdk bootstrap aws://<ACCOUNT_ID>/<REGION> \
  -c ebSolutionStackName="64bit Amazon Linux 2023 v4.9.2 running Docker"
```

Example:
```bash
npx cdk bootstrap aws://134502866110/us-east-2 \
  -c ebSolutionStackName="64bit Amazon Linux 2023 v4.9.2 running Docker"
```

### 3. Deploy

```bash
cd infra
npx cdk deploy \
  -c ebSolutionStackName="64bit Amazon Linux 2023 v4.9.2 running Docker" \
  -c singleInstance=true \
  -c awsRegion=us-east-2
```

First deploy takes ~10-15 minutes (RDS and ElastiCache take time to provision). Subsequent code-only deploys take ~3-5 minutes.

### 4. Verify

```bash
curl http://vanlifevibes-prod.us-east-2.elasticbeanstalk.com/api/v1/health/
# Expected: {"status":"healthy"}
```

## Deploy Commands

### Redeploy after code changes

Same command every time — CDK detects what changed and only updates what's needed:

```bash
cd infra
npx cdk deploy \
  -c ebSolutionStackName="64bit Amazon Linux 2023 v4.9.2 running Docker" \
  -c singleInstance=true \
  -c awsRegion=us-east-2
```

### Preview changes without deploying

```bash
cd infra
npx cdk diff \
  -c ebSolutionStackName="64bit Amazon Linux 2023 v4.9.2 running Docker" \
  -c singleInstance=true \
  -c awsRegion=us-east-2
```

## CDK Context Parameters

All parameters are passed via `-c key=value` flags. Defaults are in `infra/bin/infra.ts`.

| Parameter | Default | Description |
|---|---|---|
| `ebSolutionStackName` | *(required)* | EB platform version (e.g. `"64bit Amazon Linux 2023 v4.9.2 running Docker"`) |
| `singleInstance` | `false` | `true` = no load balancer (cheaper), `false` = ALB + auto-scaling |
| `awsRegion` | `us-east-1` | AWS region to deploy to |
| `appName` | `vanlifevibes` | App name prefix for all resources |
| `environmentName` | `prod` | Environment name (prod, staging, etc.) |
| `instanceType` | `t3.small` | EC2 instance type for EB |
| `dbInstanceType` | `t4g.micro` | RDS instance type |
| `redisNodeType` | `cache.t4g.micro` | ElastiCache node type |
| `customDomain` | *(empty)* | Custom domain (e.g. `api.vanlifevibes.com`) |
| `acmCertificateArn` | *(empty)* | ACM certificate ARN for HTTPS |
| `corsAllowedOrigins` | *(auto)* | Comma-separated CORS origins |
| `dbName` | `vanlifevibes` | PostgreSQL database name |
| `dbUsername` | `vanlifevibes_admin` | PostgreSQL username |
| `emailHostUser` | *(empty)* | SES SMTP username |
| `emailHostPassword` | *(empty)* | SES SMTP password |
| `revenuecatWebhookSecret` | *(empty)* | RevenueCat webhook secret |

## What Happens on Deploy

1. CDK packages the repo (excluding `.git`, `.venv`, `node_modules`, `media`, etc.) as a source bundle
2. Uploads the bundle to S3
3. EB builds the Docker image using `Dockerfile` (installs deps, runs `collectstatic`)
4. EB starts the container using `entrypoint.sh`:
   - Runs `migrate --noinput` (auto-applies any new migrations)
   - Starts Daphne ASGI server on port 8000
5. EB's nginx reverse proxy maps port 80 → 8000
6. EB health check polls `/api/v1/health/` to confirm the instance is healthy

## Environment Variables

CDK automatically sets all required environment variables on the EB environment. You do NOT need to manually set them. They include:

- `DJANGO_ENV=production`
- `SECRET_KEY` (from Secrets Manager)
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` (from RDS + Secrets Manager)
- `USE_S3_STORAGE=True`
- `AWS_STORAGE_BUCKET_NAME`, `AWS_S3_REGION_NAME`
- `REDIS_URL` (from ElastiCache)
- `CORS_ALLOWED_ORIGINS`
- `EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`
- `REVENUECAT_WEBHOOK_SECRET`

### Django Settings Controlled by Env Vars

These can be overridden via EB environment properties if needed:

| Setting | Env Var | Default |
|---|---|---|
| SSL redirect | `SECURE_SSL_REDIRECT` | `False` (set `True` when you add HTTPS) |
| Upload size limit | `UPLOAD_MAX_BYTES` | `25 MB` (26214400 bytes) |

To override an env var without redeploying code:
```bash
aws elasticbeanstalk update-environment \
  --environment-name vanlifevibes-prod-env \
  --option-settings Namespace=aws:elasticbeanstalk:application:environment,OptionName=UPLOAD_MAX_BYTES,Value=26214400 \
  --region us-east-2
```

## Mobile App Configuration

Update `mobile-app/.env` to point at the deployed backend:

```
EXPO_PUBLIC_API_BASE_URL=http://vanlifevibes-prod.us-east-2.elasticbeanstalk.com/api/v1
EXPO_PUBLIC_WS_BASE_URL=ws://vanlifevibes-prod.us-east-2.elasticbeanstalk.com
```

Restart Expo with cache clear after changing:
```bash
cd mobile-app && npx expo start -c --lan
```

## Running Management Commands

SSH into the EB instance and run commands inside the Docker container:

```bash
# Install EB CLI if needed
pip install awsebcli

# Initialize EB CLI in the project root (one-time)
eb init vanlifevibes --region us-east-2

# SSH into the instance
eb ssh vanlifevibes-prod-env
```

Once connected:
```bash
# Find the running container
sudo docker ps

# Run management commands
sudo docker exec -it <container-id> uv run python manage.py createsuperuser
sudo docker exec -it <container-id> uv run python manage.py seed_users
sudo docker exec -it <container-id> uv run python manage.py shell
sudo docker exec -it <container-id> uv run python manage.py dbshell
```

## Adding a Custom Domain + HTTPS (Later)

1. Register/transfer a domain (Route 53 or external registrar)
2. Request an ACM certificate in the same region:
   ```bash
   aws acm request-certificate \
     --domain-name api.yourdomain.com \
     --validation-method DNS \
     --region us-east-2
   ```
3. Complete DNS validation
4. Redeploy with domain and cert:
   ```bash
   cd infra
   npx cdk deploy \
     -c ebSolutionStackName="64bit Amazon Linux 2023 v4.9.2 running Docker" \
     -c singleInstance=false \
     -c awsRegion=us-east-2 \
     -c customDomain=api.yourdomain.com \
     -c acmCertificateArn=arn:aws:acm:us-east-2:134502866110:certificate/xxx
   ```
   Note: HTTPS requires a load balancer, so `singleInstance` must be `false`.
5. Enable SSL redirect:
   ```bash
   aws elasticbeanstalk update-environment \
     --environment-name vanlifevibes-prod-env \
     --option-settings Namespace=aws:elasticbeanstalk:application:environment,OptionName=SECURE_SSL_REDIRECT,Value=True \
     --region us-east-2
   ```
6. Create a CNAME or alias record pointing `api.yourdomain.com` to the EB environment URL

## Monitoring & Logs

```bash
# Check environment health
aws elasticbeanstalk describe-environment-health \
  --environment-name vanlifevibes-prod-env \
  --attribute-names All \
  --region us-east-2

# Tail recent logs
aws elasticbeanstalk request-environment-info \
  --environment-name vanlifevibes-prod-env \
  --info-type tail \
  --region us-east-2

# Retrieve logs (run after request-environment-info)
aws elasticbeanstalk retrieve-environment-info \
  --environment-name vanlifevibes-prod-env \
  --info-type tail \
  --region us-east-2
```

Or use EB CLI:
```bash
eb health vanlifevibes-prod-env
eb logs vanlifevibes-prod-env
```

## Tear Down

To destroy all resources:
```bash
cd infra
npx cdk destroy \
  -c ebSolutionStackName="64bit Amazon Linux 2023 v4.9.2 running Docker" \
  -c singleInstance=true \
  -c awsRegion=us-east-2
```

Note: RDS will create a final snapshot before deletion (`RemovalPolicy.SNAPSHOT`).

## Troubleshooting

| Issue | Fix |
|---|---|
| Health check failing | Check `eb logs` for migration or startup errors |
| 502 Bad Gateway | Daphne may not be running — check container logs |
| 301 redirect loop | `SECURE_SSL_REDIRECT` is `True` but no HTTPS configured — set it to `False` |
| Static files not loading | Verify `USE_S3_STORAGE=True` and S3 bucket permissions |
| DB connection refused | Check RDS security group allows EB inbound on 5432 |
| WebSocket not connecting | Ensure ALB type (not CLB) and sticky sessions enabled |
| `413 Request Entity Too Large` | Set `UPLOAD_MAX_BYTES` env var and update nginx `client_max_body_size` |
| S3 bucket already exists (deploy fail) | Delete orphaned bucket: `aws s3 rb s3://bucket-name --force` |
| Stack in ROLLBACK_FAILED | Delete stack: `aws cloudformation delete-stack --stack-name VanlifeInfraStack --region us-east-2` |
| Solution stack not found | List available: `aws elasticbeanstalk list-available-solution-stacks --region us-east-2 --query "SolutionStacks[?contains(@,'Docker')]"` |
