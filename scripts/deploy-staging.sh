#!/bin/bash

# Agentris Staging Deployment Script
# This script deploys the application to a staging environment
# Currently configured for local/development staging, but ready for cloud deployment

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_ENV="${DEPLOY_ENV:-staging}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
CONTAINER_REGISTRY="${CONTAINER_REGISTRY:-ghcr.io}"
IMAGE_NAME="${IMAGE_NAME:-${GITHUB_REPOSITORY:-agentris/agentris}}"
DEPLOY_HOST="${DEPLOY_HOST:-localhost}"
DEPLOY_PORT="${DEPLOY_PORT:-3000}"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[DEPLOY]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    # Check required environment variables
    if [ -z "$DATABASE_URL" ]; then
        print_error "DATABASE_URL environment variable is required"
        print_status "Please set DATABASE_URL from your secret management system (e.g., GitHub Secrets, AWS Secrets Manager)"
        exit 1
    fi
    
    if [ -z "$NEXTAUTH_SECRET" ]; then
        print_error "NEXTAUTH_SECRET environment variable is required"
        print_status "Please set NEXTAUTH_SECRET from your secret management system"
        print_status "To generate a new secret: openssl rand -base64 32"
        exit 1
    fi
    
    print_status "Prerequisites check completed"
}

# Function to pull latest image
pull_image() {
    print_status "Pulling latest image..."
    
    local full_image="${CONTAINER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
    
    if docker pull "$full_image"; then
        print_status "Image pulled successfully: $full_image"
    else
        print_warning "Could not pull image, will use local build"
        return 1
    fi
}

# Function to stop existing container
stop_existing() {
    print_status "Checking for existing containers..."
    
    if docker ps -a | grep -q agentris-staging; then
        print_status "Stopping existing container..."
        docker stop agentris-staging || true
        docker rm agentris-staging || true
    fi
}

# Function to start new container
start_container() {
    print_status "Starting new container..."
    
    local full_image="${CONTAINER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
    
    # Run the container with environment variables passed directly
    # Using bridge networking instead of host network for better security
    docker run -d \
        --name agentris-staging \
        -e NODE_ENV=production \
        -e DATABASE_URL="${DATABASE_URL}" \
        -e NEXTAUTH_SECRET="${NEXTAUTH_SECRET}" \
        -e NEXTAUTH_URL="http://${DEPLOY_HOST}:${DEPLOY_PORT}" \
        -e ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}" \
        -e REDIS_URL="${REDIS_URL:-redis://redis:6379}" \
        -p ${DEPLOY_PORT}:3000 \
        --restart unless-stopped \
        --network bridge \
        --add-host=host.docker.internal:host-gateway \
        "$full_image"
    
    print_status "Container started successfully"
}

# Function to verify deployment
verify_deployment() {
    print_status "Verifying deployment..."
    
    # Wait for application to be ready
    local max_attempts=30
    local attempt=0
    local health_endpoint="http://${DEPLOY_HOST}:${DEPLOY_PORT}/api/health"
    
    while [ $attempt -lt $max_attempts ]; do
        if response=$(curl -f -s --max-time 5 "$health_endpoint" 2>/dev/null); then
            # Check if response contains healthy status
            if echo "$response" | grep -q '"status":"healthy"'; then
                print_status "Deployment verified successfully!"
                echo -e "${GREEN}Application is running at: http://${DEPLOY_HOST}:${DEPLOY_PORT}${NC}"
                print_status "Health check response: $response"
                return 0
            else
                print_warning "Health check returned non-healthy status"
            fi
        fi
        
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    
    print_error "Deployment verification failed after $((max_attempts * 2)) seconds"
    # Try to get container logs for debugging
    docker logs --tail 20 agentris-staging 2>&1 || true
    return 1
}

# Function to rollback on failure
rollback() {
    print_error "Deployment failed, rolling back..."
    
    # Stop failed container
    docker stop agentris-staging || true
    docker rm agentris-staging || true
    
    # Try to restart previous version if it exists
    if docker ps -a | grep -q agentris-staging-backup; then
        docker rename agentris-staging-backup agentris-staging
        docker start agentris-staging
        print_status "Rolled back to previous version"
    fi
}

# Main deployment flow
main() {
    print_status "Starting deployment to ${DEPLOY_ENV}..."
    print_status "Image: ${CONTAINER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
    
    # Check prerequisites
    check_prerequisites
    
    # Pull latest image (optional, continues if fails)
    pull_image || true
    
    # Stop existing container
    stop_existing
    
    # Start new container
    if start_container; then
        # Verify deployment
        if verify_deployment; then
            print_status "Deployment completed successfully!"
            exit 0
        else
            rollback
            exit 1
        fi
    else
        print_error "Failed to start container"
        rollback
        exit 1
    fi
}

# Run main function
main "$@"