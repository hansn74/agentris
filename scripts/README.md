# Agentris Scripts

This directory contains deployment and utility scripts for the Agentris application.

## Available Scripts

### deploy-staging.sh

Deploys the Agentris application to a staging environment.

#### Usage

```bash
./scripts/deploy-staging.sh
```

#### Environment Variables

The script uses the following environment variables:

| Variable             | Description                  | Default                                                  |
| -------------------- | ---------------------------- | -------------------------------------------------------- |
| `DEPLOY_ENV`         | Deployment environment name  | `staging`                                                |
| `IMAGE_TAG`          | Docker image tag to deploy   | `latest`                                                 |
| `CONTAINER_REGISTRY` | Container registry URL       | `ghcr.io`                                                |
| `IMAGE_NAME`         | Full image name              | `${GITHUB_REPOSITORY}` or `agentris/agentris`            |
| `DEPLOY_HOST`        | Host to deploy to            | `localhost`                                              |
| `DEPLOY_PORT`        | Port to expose application   | `3000`                                                   |
| `DATABASE_URL`       | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/agentris` |
| `NEXTAUTH_SECRET`    | NextAuth.js secret key       | Auto-generated if not set                                |
| `ANTHROPIC_API_KEY`  | Anthropic API key for Claude | Optional                                                 |
| `REDIS_URL`          | Redis connection string      | `redis://localhost:6379`                                 |

#### Features

- **Health Check**: Automatically verifies deployment by checking `/api/health` endpoint
- **Rollback**: Automatic rollback on deployment failure
- **Container Management**: Stops existing containers before deploying new ones
- **Environment Configuration**: Creates temporary `.env.staging` file with proper configuration
- **Color-coded Output**: Clear status messages with color coding

#### Prerequisites

- Docker installed and running
- Access to container registry (for pulling images)
- Network access to deployment target

#### Deployment Flow

1. Check prerequisites (Docker, environment variables)
2. Pull latest Docker image from registry
3. Stop any existing staging containers
4. Start new container with staging configuration
5. Verify deployment health
6. Rollback on failure

#### Manual Deployment

For manual deployment without the script:

```bash
# Pull the image
docker pull ghcr.io/your-org/agentris:latest

# Stop existing container
docker stop agentris-staging && docker rm agentris-staging

# Run new container
docker run -d \
  --name agentris-staging \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://..." \
  -e NEXTAUTH_SECRET="..." \
  -p 3000:3000 \
  ghcr.io/your-org/agentris:latest
```

## CI/CD Integration

These scripts are integrated with GitHub Actions workflows:

- **Automatic Deployment**: On push to `main` branch, the CI workflow automatically deploys to staging
- **Manual Deployment**: Can be triggered manually from GitHub Actions UI
- **Environment Secrets**: Configure GitHub Secrets for sensitive environment variables

## Future Enhancements

- [ ] Add production deployment script
- [ ] Implement blue-green deployment strategy
- [ ] Add database migration automation
- [ ] Integrate with monitoring systems
- [ ] Add deployment notifications (Slack, email)
