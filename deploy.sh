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

info "Fetching latest changes from git..."
git fetch origin

info "Checking out branch: ${BRANCH}..."
git checkout "${BRANCH}"

info "Resetting to latest code from git (branch: ${BRANCH})..."
git reset --hard origin/"${BRANCH}"

info "rebuilding Dockerimage"
docker compose build php

info "stopping containers to clear OPcache"
docker compose down

info "starting containers with new Dockerimage"
docker compose up -d

info "Installing Composer dependencies (production mode)..."
docker compose exec -T --user www-data php composer install --no-dev --optimize-autoloader --no-interaction < /dev/null || echo "WARNING: Composer install had non-zero exit"

info "Building frontend assets..."
mkdir -p web/static/dist
npm install --no-audit --no-fund || echo "WARNING: npm install had issues"
npm run build || { echo "ERROR: npm build failed!"; exit 1; }

info "Verifying build artifacts..."
MANIFEST_FILE="web/static/dist/manifest.json"
if [ ! -f "$MANIFEST_FILE" ]; then
    echo "ERROR: manifest.json not found at $MANIFEST_FILE"
    exit 1
fi

# Check if manifest was modified in the last 60 seconds
if [ $(find "$MANIFEST_FILE" -mmin -1 2>/dev/null | wc -l) -eq 0 ]; then
    echo "ERROR: manifest.json was not updated by the build!"
    echo "Last modified: $(stat -c '%y' "$MANIFEST_FILE" 2>/dev/null || stat -f '%Sm' "$MANIFEST_FILE")"
    exit 1
fi
info "Build verified - manifest.json updated successfully"

info "Running Craft migrations..."
docker compose exec -T --user www-data php ./craft migrate/all --interactive=0 < /dev/null || echo "No migrations to run"

info "Applying project config..."
docker compose exec -T --user www-data php ./craft project-config/apply --force < /dev/null || echo "No project config changes"

info "Clearing Craft caches..."
docker compose exec -T --user www-data php ./craft clear-caches/all < /dev/null

info "Deployment complete!"
ENDSSH

# Check if deployment was successful
if [ $? -eq 0 ]; then
    info "✓ Deployment to ${SERVER} completed successfully!"
    info "Site should be accessible at: https://${DOMAIN}"
else
    error "✗ Deployment failed. Check the output above for errors."
fi
