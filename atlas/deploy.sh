#!/usr/bin/env bash
# Atlas Agent deploy script - run on vm-dax-dev
# Usage: bash ~/mission-control/atlas/deploy.sh
set -e
REPO_DIR="$HOME/mission-control"
ENV_FILE="$HOME/.atlas.env"

echo "[deploy] Pulling mission-control..."
if [ -d "$REPO_DIR/.git" ]; then git -C "$REPO_DIR" pull --rebase origin main
else git clone https://github.com/scubarichard/mission-control "$REPO_DIR"; fi

if [ ! -f "$ENV_FILE" ]; then
echo "[deploy] Writing $ENV_FILE template..."
cat > "$ENV_FILE" << ENV
INSTANTLY_API_KEY=82378a2f-45a9-4c1d-a938-84241722b126:LcyOSsWxTtru
SLACK_BOT_TOKEN=
SLACK_CHANNEL=C0APVGG486M
GITHUB_TOKEN=
GIT_USER_EMAIL=atlas@dakona.net
GIT_USER_NAME=Atlas
ENV
fi

echo "[deploy] Installing systemd service..."
sudo cp "$REPO_DIR/atlas/atlas-agent.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable atlas-agent

echo ""
echo "=== Deploy complete ==="
echo "Set SLACK_BOT_TOKEN + GITHUB_TOKEN in $ENV_FILE then:"
echo "  sudo systemctl start atlas-agent"
echo "  journalctl -u atlas-agent -f"
