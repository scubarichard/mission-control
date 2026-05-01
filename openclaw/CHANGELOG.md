# OpenClaw Changelog

## 2026-05-01 — Chief of Staff Reconfiguration (Forge)

**Task:** P1 — Reconfigure OpenClaw on vm-dax-dev as noise-suppressed Chief of Staff

### Configuration Changes

**openclaw.json**
- Heartbeat interval: 30m → 2h (gate-check only, no proactive posts)
- Slack dmPolicy: open → pairing (prevents unsolicited DMs to Richard)
- Slack channels: added #dax-collab (C0APVGG486M) for agent coordination; disabled #alerts

**cron/jobs.json (via CLI)**
- Added `morning-briefing`: 7:00 AM CT daily, isolated session, claude-haiku-4-5
- Added `eod-recap`: 6:00 PM CT daily, isolated session, claude-haiku-4-5
- Both deliver via Telegram to Richard (chat ID: 7337480629)

**Gateway**
- Restarted via PM2 (process: openclaw-gateway, id 1)
- PM2 state saved for persistence

### Workspace Files Changed (main workspace)

| File | Action |
|------|--------|
| BOOTSTRAP.md | Replaced — Chief of Staff operating instructions |
| IDENTITY.md | Updated — noise-suppressed CoS, priority hierarchy, Forge handoff |
| USER.md | Appended — email suppression rules, send-from defaults, operating context |
| HEARTBEAT.md | Replaced — gate-check only (no proactive Slack/Telegram posts) |
| SOUL.md | Created — Chief of Staff soul |
| MORNING_BRIEFING.md | Created — 7am briefing format, steps, hard rules |
| EOD_RECAP.md | Created — 6pm recap format, steps, hard rules |

### Workspace Files Changed (workspace-pm)

| File | Action |
|------|--------|
| HEARTBEAT.md | Replaced — gate-check only (suppressed ghost bike / luggage transfer proactive posts) |

### Backup

Original persona backed up to: `~/openclaw-persona-backup-2026-05-01.md`

### Status

- Test briefing: triggered manually → output posted to #dax-collab for Richard review
- Cron schedule: PAUSED until Richard approves test run
- First live 7am run: next morning after Richard approval
