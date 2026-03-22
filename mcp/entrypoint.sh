#!/bin/bash
set -e

# Authenticate Azure CLI with managed identity (if running in Azure)
if [ -n "$IDENTITY_HEADER" ] || [ -n "$MSI_ENDPOINT" ]; then
  echo "Authenticating Azure CLI with managed identity..."
  az login --identity --allow-no-subscriptions -o none 2>/dev/null || \
    echo "Warning: az login --identity failed; Azure tools may not work."
fi

# Clone DAX repo so file/git/search tools work on real code
REPO_DIR="${DAX_REPO_PATH:-/repo}"
if [ -n "$GITHUB_TOKEN" ] && [ ! -d "$REPO_DIR/.git" ]; then
  echo "Cloning DAX repo into $REPO_DIR..."
  git clone --depth 50 \
    "https://x-access-token:${GITHUB_TOKEN}@github.com/scubarichard/dax.git" \
    "$REPO_DIR" 2>&1 || echo "Warning: git clone failed; file/git tools will be limited."
  if [ -d "$REPO_DIR/.git" ]; then
    cd "$REPO_DIR"
    git config user.email "dax-mcp@dakona.com"
    git config user.name "DAX MCP Server"
    echo "Repo cloned: $(git log --oneline -1)"
  fi
elif [ -d "$REPO_DIR/.git" ]; then
  echo "Repo already exists at $REPO_DIR, pulling latest..."
  cd "$REPO_DIR" && git pull --ff-only 2>&1 || echo "Warning: git pull failed."
fi

exec node /app/server.js
