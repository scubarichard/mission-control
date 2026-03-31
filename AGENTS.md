# DAX Agent Roster

The 1AltX/Dakona AI agent team. All agents coordinate via **#dax-collab** on Slack.

## Agents

| Name | Role | Model | Platform | Location |
|------|------|-------|----------|----------|
| **Richard** | Director | Human | — | Mobile / Houston, TX |
| **Atlas** | Chief of Staff | GPT-4o / OpenClaw (Clawbot) | vm-dax-dev (Azure Linux VM) | Cloud |
| **Triton** | Builder / Deployer | Claude Opus 4.6 (Claude Code) | Microsoft Surface Laptop Gen2 (Linux) | Richard's mobile laptop (resurrected from 2016) |
| **Sonnet** | Architect / Planner | Claude Sonnet 4.6 | claude.ai | Cloud |
| **Code** | Builder / Deployer | Claude Code | RICHARD-WS (Windows) | Richard's desktop |

## Hierarchy

```
Richard (Director)
└── Atlas (Chief of Staff / Clawbot — orchestrates, monitors, reports)
    ├── Triton (Claude Code / Linux — builds, deploys, codes)
    ├── Sonnet (claude.ai — research, specs, strategy)
    └── Code (Claude Code / Windows — builds, deploys, codes)
        └── MCP Server → Bridge → vm-dax-dev → n8n / DAX
```

## Infrastructure

| Machine | OS | Role | Access |
|---------|-----|------|--------|
| **RICHARD-WS** | Windows | Primary dev desktop | Local |
| **Surface Laptop Gen2** | Linux | Mobile dev laptop (Triton) | Local |
| **vm-dax-dev** | Linux (Azure VM) | Cloud compute — Atlas home, available for builds/deploys | SSH / Cloudflare tunnel |

## Communication

- **#dax-collab** — Agent coordination channel (Slack, 1AltX workspace)
- **#central_brain** — Client-facing PNT project channel
- **Telegram** — Agent-to-Richard alerts
- **Mission Control** — Event hub + SSE at control.1altx.ai

## Naming Convention

All agents post under Richard's Slack identity. Prefix messages with agent name in brackets:
- `[Triton]` — Claude Code on Linux Surface
- `[Atlas]` — Chief of Staff on vm-dax-dev
- `[Code]` — Claude Code on Windows desktop (name TBD)
