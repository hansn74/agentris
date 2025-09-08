# Deployment Secrets Configuration

## Required Environment Variables

The deployment scripts require proper secret management. Never commit secrets to the repository.

### Setting up GitHub Secrets for CI/CD

1. Go to your repository Settings → Secrets and variables → Actions
2. Add the following repository secrets:

```
DATABASE_URL        - PostgreSQL connection string (without password in logs)
NEXTAUTH_SECRET     - Random 32+ character string for NextAuth
ANTHROPIC_API_KEY   - Your Anthropic API key (if using AI features)
REDIS_URL           - Redis connection string
```

### Local Development Deployment

For local staging deployment, use environment variables:

```bash
# Option 1: Use a .env file (never commit this!)
cp .env.example .env.staging
# Edit .env.staging with your secrets

# Load the environment and deploy
export $(cat .env.staging | xargs) && ./scripts/deploy-staging.sh

# Option 2: Use a secret management tool
# Example with AWS Secrets Manager
aws secretsmanager get-secret-value --secret-id agentris/staging --query SecretString --output text | \
  jq -r 'to_entries|map("\(.key)=\(.value)")|.[]' | \
  xargs -I {} sh -c 'export {} && ./scripts/deploy-staging.sh'
```

### Production Deployment

For production, always use a proper secret management service:

- **AWS**: AWS Secrets Manager or Parameter Store
- **Azure**: Azure Key Vault
- **GCP**: Google Secret Manager
- **Kubernetes**: Kubernetes Secrets with encryption at rest
- **HashiCorp Vault**: Enterprise secret management

### Generating Secrets

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate strong passwords
openssl rand -base64 24
```

### Security Best Practices

1. **Never hardcode secrets** in scripts or code
2. **Rotate secrets regularly** (at least every 90 days)
3. **Use different secrets** for each environment (dev, staging, prod)
4. **Audit secret access** through your secret management system
5. **Encrypt secrets at rest** and in transit
6. **Limit secret scope** to only services that need them
7. **Monitor for exposed secrets** using tools like TruffleHog

### Container Security

The deployment script now uses:

- Bridge networking instead of host networking for better isolation
- Direct environment variable injection instead of temporary files
- No default credentials - deployment fails if secrets are not provided

### Troubleshooting

If deployment fails due to missing secrets:

1. Verify all required environment variables are set:

   ```bash
   echo $DATABASE_URL
   echo $NEXTAUTH_SECRET
   ```

2. Check that secrets don't contain special characters that need escaping

3. Ensure your secret management system is properly authenticated

4. For GitHub Actions, verify secrets are set at the repository level
