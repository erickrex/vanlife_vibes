# Deploying VanlifeVibes to AWS Elastic Beanstalk

## Prerequisites

- **AWS Account** with permissions for EB, RDS, S3, and ACM
- **EB CLI** installed (`pip install awsebcli`) and configured (`eb init`)
- **ACM Certificate** for your custom domain (or the EB default domain for HTTPS)
- **AWS CLI** configured with credentials (`aws configure`)

## 1. Create the RDS PostgreSQL Instance

1. Go to **AWS Console → RDS → Create database**
2. Choose **PostgreSQL** (version 15+)
3. Settings:
   - DB instance identifier: `vanlifevibes-db`
   - Master username: `vanlifevibes_admin`
   - Set a strong master password
4. Under **Connectivity**, place it in the same VPC as your EB environment
5. Note the **Endpoint** hostname — you'll need it for `DB_HOST`

> Make sure the RDS security group allows inbound traffic on port 5432 from the EB security group.

## 2. Create the S3 Bucket

1. Go to **AWS Console → S3 → Create bucket**
2. Bucket name: e.g. `vanlifevibes-assets`
3. Region: same as your EB environment (e.g. `us-east-1`)
4. Leave "Block all public access" **on** — the app uses signed URLs or the bucket policy can be tuned later
5. The EB instance role needs `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, and `s3:ListBucket` permissions on this bucket

## 3. Create the EB Environment

```bash
# Initialize EB in the project root (one-time)
eb init vanlifevibes --platform "Docker" --region us-east-1

# Create the environment
eb create vanlifevibes-prod \
  --instance_type t3.small \
  --elb-type application \
  --single  # remove --single for multi-instance with load balancer
```

### Update the ACM Certificate ARN

Edit `.ebextensions/02_alb.config` and replace `<your-acm-cert-arn>` with your actual ACM certificate ARN:

```yaml
aws:elbv2:listener:443:
  SSLCertificateArns: arn:aws:acm:us-east-1:123456789:certificate/abc-def-123
```

## 4. Set Environment Variables

Reference `.env.production.example` for the full list. Set them via the EB CLI:

```bash
eb setenv \
  SECRET_KEY="$(python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')" \
  DJANGO_ENV=production \
  ALLOWED_HOSTS="vanlifevibes-prod.us-east-1.elasticbeanstalk.com,yourcustomdomain.com" \
  DB_NAME=vanlifevibes \
  DB_USER=vanlifevibes_admin \
  DB_PASSWORD=your-rds-password \
  DB_HOST=your-db-host.rds.amazonaws.com \
  DB_PORT=5432 \
  USE_S3_STORAGE=True \
  AWS_STORAGE_BUCKET_NAME=vanlifevibes-assets \
  AWS_S3_REGION_NAME=us-east-1 \
  CORS_ALLOWED_ORIGINS="https://yourcustomdomain.com" \
  EMAIL_HOST_USER=your-ses-smtp-username \
  EMAIL_HOST_PASSWORD=your-ses-smtp-password \
  DEFAULT_FROM_EMAIL=noreply@yourcustomdomain.com
```

You can also set these in the **AWS Console → Elastic Beanstalk → Configuration → Software → Environment properties**.

## 5. Deploy

```bash
eb deploy
```

This will:
1. Upload the source bundle to EB
2. Build the Docker image (installs deps, runs `collectstatic`)
3. Start the container (runs migrations via `entrypoint.sh`, then starts Daphne)
4. EB polls `/api/v1/health/` to confirm the instance is healthy

Check deployment status:

```bash
eb status
eb health
eb logs
```

## 6. Subsequent Updates

For code changes, just commit and deploy:

```bash
git add .
git commit -m "feat: your changes"
eb deploy
```

EB performs a rolling update — the new container runs migrations and starts Daphne automatically.

## 7. Running Management Commands

SSH into the EB instance and run commands inside the Docker container:

```bash
eb ssh
```

Once connected:

```bash
# Find the running container
sudo docker ps

# Execute commands in the container
sudo docker exec -it <container-id> uv run python manage.py createsuperuser
sudo docker exec -it <container-id> uv run python manage.py shell
sudo docker exec -it <container-id> uv run python manage.py dbshell
```

## 8. Troubleshooting

| Issue | Fix |
|---|---|
| Health check failing | Check `eb logs` for migration or startup errors |
| 502 Bad Gateway | Daphne may not be running — check container logs |
| Static files not loading | Verify `USE_S3_STORAGE=True` and S3 bucket permissions |
| DB connection refused | Check RDS security group allows EB inbound on 5432 |
| WebSocket not connecting | Ensure ALB is `application` type and sticky sessions are enabled |
