# DAX Agent Roster

The 1AltX/Dakona AI agent team.

## Agents

| Name | Role | Model | Platform | Location |
|------|------|-------|----------|----------|
| **Richard** | Director | Human | — | Mobile / Houston, TX |
| **Forge** | Builder / Deployer | Claude Code | RICHARD-WS (Windows) | Richard's desktop |
| **Triton** | Builder / Deployer | Claude Sonnet 4.6 | Surface Laptop Gen2 (Linux) | Richard's mobile laptop |
| **Nautilus** | Builder / Deployer | Claude Sonnet 4.6 | LAN Workstation (Ubuntu 24.04, i7-4790, 16GB) | 192.168.1.186 |
| **Atlas** | Infrastructure Bot + Monitoring | GPT-4o / OpenClaw + atlas_agent.py | vm-dax-dev (Azure Linux VM) | Cloud — polls :04 |

## Hierarchy

```
Richard (Director)
├── Forge    (Claude Code / Windows — builds, deploys, desktop bridge)
├── Triton   (Claude Code / Linux Surface — builds, deploys, mobile)
│     └── Nautilus (Claude Code / LAN workstation — reports to Triton)
└── Atlas    (Clawbot + atlas_agent.py / vm-dax-dev — polls :04, monitoring, self-assigns tasks)
```

## How Work Gets Done

- **Richard** assigns tasks directly to Forge, Triton, or Nautilus via TASK_QUEUE.md or conversation
- **Triton + Nautilus** can run in parallel on independent workstreams
- **Forge** handles Windows-specific tasks and the desktop MCP bridge
- **Atlas** runs scheduled maintenance in the background (monitoring, cleanup, cron jobs)
- Agents coordinate via **TASK_QUEUE.md** — no direct agent-to-agent Slack

## Infrastructure

| Machine | OS | Role | Access |
|---------|-----|------|--------|
| **RICHARD-WS** | Windows | Primary dev desktop (Forge) | Local |
| **Surface Laptop Gen2** | Linux | Mobile laptop (Triton) | Local |
| **LAN Workstation** | Ubuntu 24.04 | i7-4790 / 16GB — Nautilus (192.168.1.186) | SSH from Triton |
| **vm-dax-dev** | Linux (Azure VM) | Atlas home — scheduled jobs | SSH / Cloudflare tunnel |

## Communication

- **TASK_QUEUE.md** — Primary agent coordination (git-based)
- **#dax-collab** — Slack status updates (1AltX workspace)
- **#central_brain** — Client-facing PNT channel

## Agent Prefixes (Slack)

- `[Triton]` — Claude Code on Linux Surface
- `[Forge]` — Claude Code on Windows desktop
- `[Nautilus]` — Claude Code on LAN workstation
- `[Atlas]` — Clawbot on vm-dax-dev
