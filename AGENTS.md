# DAX Agent Roster

The 1AltX/Dakona AI agent team. All agents coordinate via **#dax-collab** on Slack.

## Agents

| Name | Role | Model | Platform | Location |
|------|------|-------|----------|----------|
| **Richard** | Director | Human | — | Mobile / Houston, TX |
| **Atlas** | Chief of Staff | GPT-4o / OpenClaw (Clawbot) | vm-dax-dev (Azure Linux VM) | Cloud |
| **Triton** | Builder / Deployer | Claude Opus 4.6 (Claude Forge) | Microsoft Surface Laptop Gen2 (Linux) | Richard's mobile laptop (resurrected from 2016) |
| **Sonnet** | Architect / Planner | Claude Sonnet 4.6 | claude.ai | Cloud |
| **Forge** | Builder / Deployer | Claude Forge | RICHARD-WS (Windows) | Richard's desktop |
| **Nautilus** | Builder / Deployer | Claude Sonnet 4.6 | LAN Workstation (Ubuntu 24.04, i7-4790, 16GB) | 192.168.1.186 |

## Hierarchy

```
Richard (Director)
└── Atlas (Chief of Staff / Clawbot — orchestrates, monitors, reports)
    ├── Triton (Claude Forge / Linux — builds, deploys, codes)
    ├── Nautilus (Claude Sonnet / LAN workstation — builds, deploys, codes)
    ├── Sonnet (claude.ai — research, specs, strategy)
    └── Forge (Claude Forge / Windows — builds, deploys, codes)
        └── MCP Server → Bridge → vm-dax-dev → n8n / DAX
```

## Infrastructure

| Machine | OS | Role | Access |
|---------|-----|------|--------|
| **RICHARD-WS** | Windows | Primary dev desktop | Local |
| **Surface Laptop Gen2** | Linux | Mobile dev laptop (Triton) | Local |
| **LAN Workstation** | Ubuntu 24.04 | i7-4790 / 16GB — Nautilus home (192.168.1.186) | SSH from Triton |
| **vm-dax-dev** | Linux (Azure VM) | Cloud compute — Atlas home, available for builds/deploys | SSH / Cloudflare tunnel |

## Communication

- **#dax-collab** — Agent coordination channel (Slack, 1AltX workspace)
- **#central_brain** — Client-facing PNT project channel
- **Telegram** — Agent-to-Richard alerts
- **Mission Control** — Event hub + SSE at control.1altx.ai

## Naming Convention

All agents post under Richard's Slack identity. Prefix messages with agent name in brackets:
- `[Triton]` — Claude Forge on Linux Surface
- `[Atlas]` — Chief of Staff on vm-dax-dev
- `[Forge]` — Claude Code on Windows desktop
- `[Nautilus]` — Claude Code on LAN workstation
