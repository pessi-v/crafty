#!/bin/bash

# Craft CMS Deployment Script
# Usage: ./deploy.sh
# Deploys the currently active git branch to the server

set -e  # Exit on error

# Load environment variables from .env
if [ -f .env ]; then
    export $(grep -v '^#' .env | grep -E '^DEPLOY_' | xargs)
fi

# Configuration (with .env fallbacks)
DEPLOY_SERVER="${DEPLOY_SERVER:-homeserver}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/crafty}"
DEPLOY_DOMAIN="${DEPLOY_DOMAIN:-example.com}"

# Get current git branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)
SERVER="${DEPLOY_SERVER}"
REMOTE_USER="${DEPLOY_USER}"
REMOTE_PATH="${DEPLOY_PATH}"
DOMAIN="${DEPLOY_DOMAIN}"
LOCAL_PATH="$(pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check if we're in the project root
if [ ! -f "composer.json" ] || [ ! -f "craft" ]; then
    error "This script must be run from the project root directory"
fi

# Check if git working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    warn "Git working directory is not clean. Uncommitted changes will not be deployed."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        error "Deployment cancelled"
    fi
fi

info "Starting deployment to ${SERVER}..."

# Step 1: Push to git (assuming remote is already configured)
info "Pushing latest changes to git (branch: ${BRANCH})..."
git push origin "${BRANCH}" || warn "Git push failed or already up to date"

# Step 2: SSH to server and deploy
info "Connecting to ${SERVER} and deploying..."

# Use SSH agent forwarding to allow git operations on remote server
ssh -A "${REMOTE_USER}@${SERVER}" "bash -s" -- "${REMOTE_PATH}" "${BRANCH}" << 'ENDSSH'
set -e

# Get the remote path and branch from the arguments
REMOTE_PATH="$1"
BRANCH="$2"

# Colors for output (redefined for remote session)
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() {
    echo -e "${GREEN}[REMOTE]${NC} $1"
}

# Navigate to project directory
info "Navigating to ${REMOTE_PATH}..."
cd "${REMOTE_PATH}" || exit 1
info "Current directory: $(pwd)"

info "Checking git status..."
git status

info "Pulling latest code from git (branch: ${BRANCH})..."
git pull origin "${BRANCH}"

info "rebuilding Dockerimage"
docker compose build php

info "restarting with new Dockerimage"
docker compose up -d

info "Installing Composer dependencies (production mode)..."
docker compose exec -T --user www-data php composer install --no-dev --optimize-autoloader --no-interaction

info "Checking Node.js installation..."
which node || echo "ERROR: Node.js not found!"
node --version || echo "ERROR: Cannot run node"
which npm || echo "ERROR: npm not found!"
npm --version || echo "ERROR: Cannot run npm"

info "Creating web/static/dist directory..."
mkdir -p web/static/dist

info "Installing npm dependencies and building assets on host..."
npm install || echo "WARNING: npm install failed"
npm run build || echo "ERROR: npm run build failed"

info "Verifying build artifacts exist..."
if [ ! -f "web/static/dist/manifest.json" ]; then
    echo "ERROR: Build failed - manifest.json not found!"
    ls -la web/static/ || echo "web/static/ does not exist"
    exit 1
fi

info "Build successful! Generated files:"
ls -lh web/static/dist/

info "Setting permissions on built assets..."
chown -R www-data:www-data web/static

info "Running Craft migrations..."
docker compose exec -T --user www-data php ./craft migrate/all --interactive=0 || echo "No migrations to run"

info "Applying project config..."
docker compose exec -T --user www-data php ./craft project-config/apply --force || echo "No project config changes"

info "Clearing Craft caches..."
docker compose exec -T --user www-data php ./craft clear-caches/all

info "Restarting PHP-FPM..."
docker compose restart php

info "Restarting Nginx..."
docker compose restart nginx

info "Deployment complete!"
ENDSSH

# Check if deployment was successful
if [ $? -eq 0 ]; then
    info "✓ Deployment to ${SERVER} completed successfully!"
    info "Site should be accessible at: https://${DOMAIN}"
else
    error "✗ Deployment failed. Check the output above for errors."
fi
