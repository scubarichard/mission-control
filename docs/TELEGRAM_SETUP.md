# Telegram Integration for All Agents

Bot: @Dax_dakona_bot
Chat ID: 7337480629 (Richard Mabbun DM)

## Environment Variables Required

```
TELEGRAM_BOT_TOKEN=<stored in P:/_tools/telegram/.env>
TELEGRAM_CHAT_ID=7337480629
```

## Path 1: send.sh Wrapper (Desktop agents)

```bash
bash "P:/_tools/telegram/send.sh" --agent "AgentName" "Your message here"
```

The script reads token from `P:/_tools/telegram/.env`.

## Path 2: Direct Bot API (Any host — Linux, Windows, anywhere)

### Send a message:
```bash
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d "{\"chat_id\":7337480629,\"text\":\"[AgentName] Your message here\"}"
```

### Read recent messages (last 30):
```bash
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=-30&limit=30"
```

Note: getUpdates only returns unprocessed messages. If Atlas/OpenClaw is polling,
the queue may be empty. To read conversation history, use the OpenClaw session
files on vm-dax-dev (see Path 3).

## Path 3: OpenClaw CLI (vm-dax-dev only)

```bash
openclaw message send --channel telegram --target 7337480629 -m "[AgentName] message"
```

## Path 4: Read Telegram History via Atlas Sessions

SSH to vm-dax-dev and read the latest session JSONL:
```bash
LATEST=$(ls -t ~/.openclaw/agents/main/sessions/*.jsonl | head -1)
python3 -c "
import json
with open('$LATEST') as f:
    for line in f:
        obj = json.loads(line.strip())
        if obj.get('type') == 'message':
            msg = obj.get('message', {})
            role = msg.get('role', '')
            content = msg.get('content')
            if isinstance(content, list):
                text = ' '.join(c.get('text','') for c in content if isinstance(c, dict) and c.get('type') == 'text')
            elif isinstance(content, str):
                text = content
            else:
                text = ''
            if text.strip() and role in ('user', 'assistant'):
                label = 'RICHARD' if role == 'user' else 'ATLAS'
                print(f'[{label}] {text[:300]}')
"
```

## Message Format
- Always prefix with agent name: [Claude Code], [Sonnet], [ATLAS], [Triton]
- Keep messages concise — Richard reads on mobile

## For Triton (Surface Laptop)

1. Set env var: `export TELEGRAM_BOT_TOKEN=<get from Richard or P:/_tools/telegram/.env>`
2. Send: `curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" -H "Content-Type: application/json" -d '{"chat_id":7337480629,"text":"[Triton] message"}'`
3. Or clone the send.sh script locally and source your own .env
