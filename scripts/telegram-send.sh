#!/usr/bin/env bash
# Telegram send wrapper for Claude Code / Sonnet sub-agents
# Usage: bash send.sh "[Agent Name] Your message here"
# Or:    bash send.sh --agent "Claude Code" "Your message here"

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/.env"
BOT_TOKEN="$TELEGRAM_BOT_TOKEN"
CHAT_ID="$TELEGRAM_CHAT_ID"
API_URL="https://api.telegram.org/bot${BOT_TOKEN}/sendMessage"

# Parse args
AGENT=""
MESSAGE=""

if [[ "${1:-}" == "--agent" ]]; then
  AGENT="$2"
  shift 2
  MESSAGE="[${AGENT}] $*"
else
  MESSAGE="$*"
fi

if [[ -z "$MESSAGE" ]]; then
  echo "Usage: send.sh [--agent <name>] <message>" >&2
  exit 1
fi

PAYLOAD=$(python3 -c "import json,sys; print(json.dumps({'chat_id':int('$CHAT_ID'),'text':sys.argv[1]}))" "$MESSAGE")
RESULT=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

OK=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ok','false'))" 2>/dev/null || echo "false")

if [[ "$OK" == "True" ]]; then
  echo "Sent to Telegram (chat $CHAT_ID)"
else
  echo "Failed: $RESULT" >&2
  exit 1
fi
