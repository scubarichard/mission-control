# DAX Project — PO Brief
**Last updated:** 2026-03-28  
**For:** Project Orchestrator (PO) — AI agent assigned to track and advance DAX

---

## What is DAX?

DAX (Dakona AI Workspace) is a governed AI product for SEC-registered RIA (Registered Investment Advisor) firms. Core differentiator: **data never leaves the firm's Microsoft tenant.**

Three pillars:
1. **Advisor productivity** — AI assistant for meeting prep, client summaries, research
2. **Compliance documentation** — structured records, audit trails, SharePoint archiving
3. **Secure AI infrastructure** — Azure-hosted, Microsoft Purview monitored, no third-party data exposure

Dakona is already the MSP/IT provider for RIA clients — trust and access are pre-established.

**Pricing:** $500–$1,500/month per firm  
**Target demo client:** Brett Stone at Impact Capital Partners (ICP) — existing Dakona MSP client  
**Demo date:** March 31, 2026 (Uniting Wealth Partners)

---

## Current Architecture (v0.5.3)

| Component | What it is | Location |
|---|---|---|
| LibreChat | Chat UI at dax.dakona.com | Azure Container App `ca-dax-dakona-pilot` |
| n8n | Workflow engine / tool router | Azure VM `n8n` (172.16.0.4, D2s_v5) |
| MCP Server | Claude.ai ↔ DAX infrastructure bridge | Azure Container App `ca-dax-mcp-dakona-pilot` |
| RAG API | File retrieval / vector search | PM2 on n8n VM, port 8000 |
| Desktop Bridge | Local Windows PowerShell bridge | Scheduled Task on Richard's machine → bridge.dakona.net |
| vm-dax-dev | Utility VM for deployments | Azure VM (172.16.0.5, B1ms) |

**Key infrastructure:**
- Azure OpenAI `gpt-4o` at `oai-dax-dakona-pilot.openai.azure.com`
- Cosmos DB `cosmos-dax-dakona-pilot`
- Key Vault `kvdaxdakonapilot`
- SharePoint at `dakonallc.sharepoint.com`
- DAX repo: `github.com/scubarichard/dax`

**Active n8n workflows:**
- DAX Router: `3tniyxZREqfnAbfo` — main agent, 27 nodes, system prompt v68
- Research & Write: `2eNUFkeZf0jsEHcq` — async doc generation pipeline
- Shell Runner: `DDYzrtekTv9PqA41` — VM shell access

---

## What's Working (v0.5.3)

- ✅ DAX chat at dax.dakona.com (LibreChat)
- ✅ 15 advisor tools (email, calendar, market data, Schwab reports, document generation)
- ✅ Quarterly review .docx → SharePoint `DAX Documents/`
- ✅ ICP template: 35-field Word doc with Mustache tags
- ✅ Research & Write pipeline → SharePoint .txt
- ✅ Schwab DDF integration (test data with 5 fictional clients)
- ✅ Compliance Portal at dax.dakona.com/compliance.html
- ✅ T6 test suite — 7/7 PASS
- ✅ MCP server stable (revision 0000020, 4h session TTL, single replica)
- ✅ vm-dax-dev commissioned (Node v20, az CLI, git, DAX repo)
- ✅ SSH infrastructure: ssh-n8n.dakona.net via Cloudflare Access OTP
- ✅ MCP managed identity: Contributor on both `rg-dax-dakona-pilot` and `dk-n8n_group`

---

## ClickUp Roadmap

**Workspace:** 1AltX LLC → Dakona → DAX folder  
**Pre v1.0 List ID:** `901712338011`

| Status | Task | ClickUp ID |
|---|---|---|
| ✅ COMPLETE | Fix audit logs — real advisor name | 86e0kaex0 |
| ✅ COMPLETE | Dynamic timezone from Exchange | 86e0kaeuh |
| ✅ COMPLETE | Cloudflare tunnel / bridge service | 86e0kaer8 |
| ✅ COMPLETE | T6 pre-demo test suite | 86e0kaep1 |
| ✅ COMPLETE | Deploy LibreChat v0.5.1 | 86e0kaek2 |
| 🔲 TO DO | v0.6.0 — Azure Functions migration | 86e0kaf5y |
| 🔲 TO DO | v0.7.0 — Copilot Studio eval | 86e0kaf8n |
| 🔲 TO DO | v1.0.0 — AppSource + self-serve provisioner | 86e0kafbm |
| 🔲 TO DO | Compliance Portal UI enhancements | 86e0kaezx |
| 🔲 TO DO | Update dakona.com/dax page | 86e0kaeuh |

---

## Immediate Next Steps

### Before March 31 Demo
- [ ] Verify DAX conversation → n8n webhook trigger works end-to-end
- [ ] Test "Generate Q1 review for John Smith" → doc in SharePoint in ~15 seconds
- [ ] Hard-coded defaults: firmName=Impact Capital Partners, advisorName=Brett Stone

### Infrastructure (This Week)
- [ ] Move 6 plaintext credentials to Key Vault: `CLICKUP_API_KEY`, `DESKTOP_BRIDGE_SECRET`, `MCP_AUTH_TOKEN`, `WEALTHBOX_API_KEY`, `FMP_API_KEY`, `FINNHUB_API_KEY`
- [ ] Harden MCP auth token — URL query param → header only
- [ ] Add 2GB swap to vm-dax-dev, then evaluate OpenClaw install
- [ ] Kill stale bridge node process (PID 30532) and restart clean

### v0.6.0 (Azure Functions Migration)
- [ ] Provision `fn-dax-dakona-pilot` (consumption plan, `rg-dax-dakona-pilot`)
- [ ] Port `get_market_data` first — no Graph dependency, proves the pattern
- [ ] Side-by-side comparison before any swap
- [ ] n8n VM stays running in parallel until all tools verified
- [ ] Net savings: ~$25/mo after dev VM cost

### v0.7.0 (Copilot Studio)
- [ ] Evaluate Microsoft Copilot Studio as LibreChat replacement
- [ ] Fully brandable as "DAX", Direct Line API compatible
- [ ] Native M365/Graph/SharePoint/Teams integration
- [ ] ~$200/mo flat licensing

---

## Key Principles (Don't Break These)

1. **All AI processing via Azure OpenAI only** — never send client data to external AI APIs
2. **Staged migrations** — nothing breaks during upgrades, run in parallel
3. **Keep advisor in DAX** — n8n handles retrieval behind the scenes
4. **`n8n_update_workflow` replaces entire workflow** — always pass complete node list
5. **`az containerapp update --set-env-vars` replaces all plaintext env vars** — re-specify everything
6. **Word doc generation uses LibreOffice** — not the `docx` npm library (produces corrupt files)

---

## People

| Name | Role |
|---|---|
| Richard (rmabbun) | Founder, Dakona LLC + 1AltX |
| Brett Stone | Target client, Impact Capital Partners |
| Virginia (vmabbun) | Dakona team |
| Paul (pdmabbun) | Dakona team |
| Aldrich Katigbak (akatigbak) | Dakona team |

---

## How to Talk to Infrastructure

```powershell
# SSH to n8n VM
.\ssh-n8n.ps1

# SSH to vm-dax-dev  
.\ssh-n8n.ps1 dev
# or just: dev (PowerShell alias)

# MCP server health
curl https://mcp.dakona.net/health

# n8n API
curl -H "X-N8N-API-KEY: <key>" https://n8n.dakona.net/api/v1/workflows
```

---

*This document is maintained in the DAX repo at `docs/PO-BRIEF.md`. Update it as milestones are completed.*
