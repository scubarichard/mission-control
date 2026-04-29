# TASK-20260429-002 — DAX Copilot Studio Migration
**Assigned to:** Nautilus  
**Priority:** High — parallel track to TASK-20260429-001  
**Dependencies:** TASK-20260429-001 (Graph SDK Migration) must reach T6 7/7 PASS before Phase 5  
**Report to:** #dax-collab after each phase  
**ICP Lock:** Phase 5 requires Richard's passcode — do not touch ICP until provided  

---

## Objective

Migrate DAX from its current LibreChat + n8n architecture to Microsoft Copilot Studio as the agent and front-end layer, with Power Automate replacing n8n for tool execution. The result is a more reliable, natively M365-integrated DAX that costs less per client and requires no VM management.

All work happens in a dev environment first. Production (dax.dakona.com) is not touched until T6 passes and Richard approves. ICP (dax.impact-cp.com) is locked until Richard provides the unlock passcode.

---

## Current Architecture (what exists today)

```
User → dax.dakona.com (Cloudflare DNS)
         → LibreChat Container App (ca-dax-dakona-pilot)
             image: acrdaxdakona.azurecr.io/librechat-dax:v0.5.3-hotfix1
             replicas: 3
         → n8n VM (Standard_D2s_v5, n8n v2.14.2)
             at n8n.dakona.net
             27 active tool workflows
         → Azure OpenAI (oai-dax-dakona-pilot.openai.azure.com)
             deployment: gpt-4o
         → Cosmos DB (cosmos-dax-dakona-pilot)
             conversation history per user
         → SharePoint (dakonallc.sharepoint.com)
             DAX Documents / DAX Reports / DAX Templates
         → MCP Container App (ca-dax-mcp-dakona-pilot)
             at mcp.dakona.net
```

**Current monthly cost (Dakona):** ~$140/mo  
**Biggest cost:** n8n VM D2s_v5 ~$75/mo (shared with 1AltX — not a pure DAX cost)

---

## Target Architecture (what we're building)

```
User → dev.dax.dakona.com (Phase 1-3) / dax.dakona.com (Phase 4+)
         → Custom React/HTML front end (simple, lightweight)
             hosted: Azure Static Web App or Container App
             communicates via: Copilot Studio Direct Line API
         → Copilot Studio Agent (DAX)
             environment: DAX-Dev (Power Platform)
             tenant: d2a3c346-00f3-47dd-a53e-caa3fca74714 (Dakona)
             channel: Custom web app via Direct Line
         → Power Automate Flows (tool execution)
             replaces: n8n Code nodes
             uses: native M365 connectors + HTTP actions
         → Azure OpenAI (same instance — oai-dax-dakona-pilot)
             DAX agent uses BYOM (bring your own model) via Azure AI connector
         → SharePoint (same libraries — no change)
         → Cosmos DB (same — conversation history)
         → Key Vault (same — secrets)
```

**Target monthly cost (Dakona DAX only):** ~$30-50/mo  
**n8n VM stays running** for 1AltX client work — just off DAX books

---

## Dev Environment Details

**URL:** `dev.dax.dakona.com`  
**DNS:** Add CNAME in Cloudflare → Azure Static Web App or Container App  
**Power Platform environment name:** `DAX-Dev`  
**Environment type:** Developer (free — no production credits consumed)  
**Tenant:** Dakona (d2a3c346-00f3-47dd-a53e-caa3fca74714)  
**SharePoint:** Use `DAX-Dev` subfolder within existing DAX Documents — do not create separate site  
**Azure OpenAI:** Same endpoint (oai-dax-dakona-pilot) — prefix all dev system prompts with [DEV] so traffic is identifiable  

---

## Credentials and Resources

### Dakona tenant
- Tenant ID: `d2a3c346-00f3-47dd-a53e-caa3fca74714`
- Azure Subscription: `36676e89-8ccf-4390-8602-e57a913755dc`
- Azure OpenAI: `oai-dax-dakona-pilot.openai.azure.com` / deployment `gpt-4o`
- SharePoint Site ID: `dakonallc.sharepoint.com,68764500-f333-44cc-8017-30489a6a9053,71b1b423-6196-4e05-b004-7298445afb6f`
- Graph API Client ID: `218064ac-bee2-4246-9709-ae7518ae71cb`
- Graph API Client Secret: in Key Vault as `DAX-Client-Secret`
- Key Vault: `kvdaxdakonapilot`
- Cosmos DB: `cosmos-dax-dakona-pilot`

### ICP tenant (LOCKED — do not use until Richard provides passcode)
- All ICP credentials are in Key Vault with prefix `ICP-`
- Do not touch until explicitly unlocked

---

## DAX Tools to Rebuild in Power Automate

These are the 15 tools currently in the DAX Router (n8n workflow `3tniyxZREqfnAbfo`). Each becomes a Power Automate flow triggered by Copilot Studio:

| Tool | n8n replacement | Power Automate connector |
|---|---|---|
| Email Tool | Read advisor inbox | Microsoft 365 — Outlook |
| Send Email Tool | Send email | Microsoft 365 — Outlook |
| Calendar Tool | Read calendar | Microsoft 365 — Calendar |
| Manage Calendar Tool | Create/update events | Microsoft 365 — Calendar |
| SharePoint Browser Tool | List/read files | SharePoint connector |
| Create Document Tool | Save files to SharePoint | SharePoint connector |
| Market Data Tool | Live prices via FMP/Finnhub | HTTP action |
| Market Summary Tool | Market news | HTTP action → Bing News |
| Client Lookup Tool | Search Wealthbox contacts | HTTP action → Wealthbox API |
| List Clients Tool | List all clients | HTTP action → Wealthbox API |
| Meeting Prep Tool | Pull client brief | Compose: Wealthbox + SharePoint |
| Generate Reports Tool | Trigger Schwab reports | HTTP action → n8n webhook (keep for now) |
| Research and Write Tool | Long-form article | Azure OpenAI connector |
| Compliance Flag Check | Reg BI check | Custom logic + SharePoint log |
| GitHub Tool | Code repo access | HTTP action → GitHub API |

**Note on Schwab:** Keep calling the existing n8n Schwab workflow via HTTP action for now. Schwab DDF integration is complex — do not rebuild it in this task. Just proxy the call.

**Note on Document Generator:** The quarterly review .docx generator (pizzip/docxtemplater) stays on n8n for now. Copilot Studio calls it via HTTP action same as today. Migrate in v1.0.

---

## DAX System Prompt (carry over from current)

The DAX agent system prompt must be preserved exactly. Get the current system prompt from:
- n8n DAX Router workflow `3tniyxZREqfnAbfo`
- Node: `DAX Agent` → `parameters.systemMessage`

Key elements to preserve:
- DAX identity and persona
- Compliance guardrails (never make specific investment recommendations)
- Tool routing instructions
- Firm name and advisor name injection
- Data sovereignty language

Add to system prompt for dev: prefix with `[DEV MODE - dev.dax.dakona.com]` so Richard can distinguish dev from production responses.

---

## Phase 1 — Power Platform Dev Environment Setup

**Estimated time: 2-3 hours**

### 1a — Create DAX-Dev environment
1. Go to make.powerapps.com → logged in as rmabbun@dakona.com
2. Environments → New
3. Name: `DAX-Dev`
4. Type: Developer
5. Region: United States
6. Purpose: DAX Copilot Studio development and testing

### 1b — Create Copilot Studio agent in DAX-Dev
1. Go to copilotstudio.microsoft.com
2. Select DAX-Dev environment
3. Create new agent: name `DAX`
4. Description: "Governed AI workspace for RIA firms — Dakona LLC"
5. Set language: English
6. Configure generative AI: enable
7. Connect to Azure OpenAI:
   - Endpoint: `https://oai-dax-dakona-pilot.openai.azure.com`
   - Deployment: `gpt-4o`
   - This keeps data inside Dakona's Azure tenant

### 1c — Set DAX system prompt
Copy the system prompt from n8n DAX Router node `DAX Agent`.
Paste into Copilot Studio agent Instructions field.
Add prefix: `[DEV] ` to distinguish from production.

### 1d — Configure Direct Line channel
1. In Copilot Studio → Channels → Custom app
2. Enable Direct Line channel
3. Copy the Direct Line secret — store in Key Vault as `DAX-Dev-DirectLine-Secret`

### 1e — Deploy simple front-end
Build a minimal HTML/JS chat UI using the Direct Line JS SDK:
```html
<!-- Minimal DAX front end — dev.dax.dakona.com -->
<!-- Uses Microsoft's Bot Framework Web Chat component -->
<!-- Direct Line secret injected server-side — never expose in client JS -->
```

Host on Azure Static Web App (free tier):
- Resource group: `rg-dax-dakona-pilot`
- Name: `stapp-dax-dev`
- Source: GitHub repo `/repo/frontend/dev/`

### 1f — Configure DNS
In Cloudflare:
- Add CNAME: `dev.dax.dakona.com` → Azure Static Web App default domain
- Enable proxy (orange cloud)

### 1g — Verify
- Open dev.dax.dakona.com in browser
- Login with rmabbun@dakona.com (Entra SSO)
- Send: `Good morning`
- DAX should respond with [DEV] prefix
- Post confirmation to #dax-collab

---

## Phase 2 — Rebuild Core Tools in Power Automate

**Estimated time: 1-2 days**

Build each tool as a Power Automate instant flow triggered by Copilot Studio. Test each tool individually before moving to the next.

### Tool build order (priority):
1. Market Data Tool — simplest, no auth complexity, proves the pattern
2. Email Tool — most used, validates Graph connector
3. Calendar Tool — validates Graph connector
4. SharePoint Browser Tool — validates SharePoint connector
5. Create Document Tool — validates SharePoint write
6. Client Lookup Tool — validates Wealthbox HTTP action
7. List Clients Tool
8. Meeting Prep Tool — composite of Client Lookup + SharePoint
9. Send Email Tool
10. Manage Calendar Tool
11. Market Summary Tool
12. Research and Write Tool
13. Compliance Flag Check
14. Generate Reports Tool (proxy to n8n)
15. GitHub Tool

### For each tool:

**Step 1 — Create Power Automate flow**
- Trigger: When Copilot Studio calls this flow (Copilot Studio connector)
- Input: user query text + any structured parameters
- Logic: call the appropriate API
- Output: return formatted text response to Copilot Studio

**Step 2 — Register flow as Copilot Studio action**
- In Copilot Studio → Actions → Add action
- Connect to the Power Automate flow
- Define input/output schema
- Add to agent's available tools

**Step 3 — Test in Copilot Studio test canvas**
- Send a test prompt that triggers the tool
- Verify the tool is called and returns correct data
- Post test result to #dax-collab

### Graph API credentials for Power Automate:
Use the existing DAX app registration:
- Client ID: `218064ac-bee2-4246-9709-ae7518ae71cb`
- Secret: pull from Key Vault `DAX-Client-Secret`
- Create a Power Automate custom connector or use HTTP action with manual auth

### Wealthbox API for Power Automate:
- API key: pull from Key Vault `WEALTHBOX-API-KEY`
- Base URL: `https://api.crmworkspace.com/v1`
- Use HTTP action — same endpoints as n8n

---

## Phase 3 — T6 Verification on dev.dax.dakona.com

**Estimated time: 2-3 hours**

Run the full T6 test suite against dev.dax.dakona.com. All 7 tests must pass.

### T6 Test prompts (exact):
1. `Good morning` — confirm DAX responds
2. `What is driving markets this morning?` then `What is SPY trading at today?` — market data
3. `Show me my clients who are interested in ESG investing` — Wealthbox client filter
4. `Which of my clients have college planning as a goal?` — Wealthbox goal filter
5. `Prep me for my meeting with George Jetson, the one with account 12345678` — meeting prep
6. `Should I put George Jetson into QQQ?` — compliance deflection (must NOT give investment advice)
7. `Generate Q1 reviews from my Schwab file` — Schwab report generation
8. `Write a 1000 word article about the impact of rising interest rates on bond portfolios and save it` — Research & Write → SharePoint

**Also test (new capabilities):**
- `Show me what files are in my DAX Documents folder` — SharePoint browser
- `Read my last 2 emails` — email reading
- `What's on my calendar today?` — calendar reading

### Pass criteria:
- All 7 T6 tests pass
- No silent failures — DAX must report errors clearly if a tool fails
- Response quality matches or exceeds current LibreChat DAX
- SharePoint files appear in DAX-Dev subfolder (not polluting production)

Post full results to #dax-collab and tag Richard.

---

## Phase 4 — Richard Review and Staging Promotion

**This phase requires Richard's explicit approval.**

1. Richard reviews dev.dax.dakona.com personally
2. Richard confirms T6 results are acceptable
3. Richard approves promotion to staging

**If approved:**
1. Export DAX agent from DAX-Dev environment
2. Import into DAX-Staging environment (or promote via Power Platform pipelines)
3. Update Cloudflare DNS: `dax.dakona.com` → new Copilot Studio front end
4. Keep LibreChat running in parallel for 48 hours as fallback
5. Run T6 again on dax.dakona.com
6. If T6 passes → decommission LibreChat container app
7. Tag release: `git tag v0.7.0`
8. Post to #dax-collab

---

## Phase 5 — ICP Deployment ⛔ LOCKED

**This phase requires Richard's unlock passcode in #dax-collab.**

Do not proceed until Richard posts the passcode.

When unlocked:

### ICP Power Platform environment
1. Log into ICP tenant using DAX-Deploy service principal
   - Client ID: `213f104f-c25b-4ccd-bf3c-d6f441384a77`
   - Secret: Key Vault `ICP-ClientSecret`
   - Tenant: `eaf1a864-97ff-451c-87e7-88cf7512e98c`
2. Create Power Platform environment in ICP tenant: `DAX-ICP`
3. Create Copilot Studio agent in ICP tenant
4. Configure with ICP-specific settings:
   - Advisor email: `brett@impact-cp.com`
   - Firm name: `Impact Capital Partners`
   - SharePoint: `impactcapitalpartnersllc.sharepoint.com`
   - Site ID: `impactcapitalpartnersllc.sharepoint.com,9408138e-0aa3-404e-b131-bc905b2d99d0,40e05979-6387-4bb6-8b8e-6638aa9c1e2f`
   - Azure OpenAI: deploy new instance in ICP subscription `e1c109d7-9232-4e26-bed7-b1e1b5a6f611`

### ICP credential differences from Dakona

| Variable | Dakona | ICP |
|---|---|---|
| Tenant ID | d2a3c346-... | eaf1a864-... |
| Client ID | 218064ac-... | 213f104f-... |
| SharePoint | dakonallc.sharepoint.com | impactcapitalpartnersllc.sharepoint.com |
| Advisor email | rmabbun@dakona.com | brett@impact-cp.com |
| Firm name | Dakona | Impact Capital Partners |
| Azure OpenAI | oai-dax-dakona-pilot | new instance in ICP tenant |
| Wealthbox | NOT connected (beta) | NOT connected (beta) |
| Schwab | NOT connected (beta) | NOT connected (beta) |

### ICP front end
- Deploy simple chat UI to Azure Static Web App in ICP subscription
- DNS: `dax.impact-cp.com` → ICP Static Web App
- SSO: brett@impact-cp.com via ICP Entra

### ICP verification checklist
```
[ ] dax.impact-cp.com loads
[ ] SSO works with brett@impact-cp.com
[ ] "Good morning" → DAX responds (no [DEV] prefix)
[ ] "What is SPY trading at today?" → live price
[ ] "Show me what files are in my DAX Documents folder" → ICP SharePoint
[ ] "Write a short article about retirement planning and save it" → saves to ICP SharePoint DAX Documents
[ ] "Read my last 2 emails" → brett@impact-cp.com inbox
[ ] "What's on my calendar today?" → brett@impact-cp.com calendar
[ ] No Dakona data visible to Brett
[ ] No ICP data visible in Dakona pilot
[ ] Compliance deflection works (QQQ test)
```

Post verification results to #dax-collab and tag Richard.

---

## What Stays on n8n (do not migrate)

These stay on n8n permanently — they are 1AltX/Dakona operations tools, not DAX client tools:

- Schwab DDF processor (complex, well-tested, leave alone)
- DAX Document Generator (pizzip/docxtemplater) — proxy call from Power Automate
- Research & Write long-form pipeline — may migrate later
- All non-DAX 1AltX client workflows
- DAX Health Check monitoring workflow (being built in TASK-20260429-001)

---

## Architecture Decision: Direct Line vs Teams vs SharePoint

For the custom web front end (dev.dax.dakona.com and dax.impact-cp.com), use **Direct Line API** with a custom React or plain HTML/JS chat component.

Do NOT use:
- Teams as the primary channel — too much friction for RIA advisors
- SharePoint embedded — too limited
- Power Pages — overkill

The custom web app gives full control over branding, UX, and the DAX look and feel. It's what dax.dakona.com is today — just backed by Copilot Studio instead of LibreChat.

Microsoft's Bot Framework Web Chat component is the fastest path:
```html
<script src="https://cdn.botframework.com/botframework-webchat/latest/webchat.js"></script>
```
Wrap it in a minimal branded shell with DAX colors (dark navy #1F3864) and the DAX logo.

---

## Execution Order

```
Phase 1 — Dev environment setup          (2-3 hrs)
  Create DAX-Dev Power Platform env
  Build Copilot Studio agent
  Connect Azure OpenAI
  Deploy front end to dev.dax.dakona.com
  Confirm basic chat works → post to #dax-collab

Phase 2 — Rebuild tools in Power Automate  (1-2 days)
  Build each tool flow in priority order
  Test each individually in Copilot Studio canvas
  Post completion of each tool to #dax-collab

Phase 3 — T6 verification on dev           (2-3 hrs)
  Run all 7 T6 tests + new SharePoint/email/calendar tests
  Must all pass
  Post results + tag Richard

Phase 4 — Richard approves → staging       (requires Richard)
  Richard reviews dev.dax.dakona.com
  Approves promotion
  Promote to dax.dakona.com
  Run T6 on staging
  Decommission LibreChat if T6 passes
  Tag v0.7.0

Phase 5 — ICP deployment ⛔ LOCKED        (requires passcode)
  Deploy to ICP tenant
  Run ICP verification checklist
  Hand off to Brett
```

**Total estimated time: 3-5 days**

---

## ⛔ ICP DEPLOYMENT LOCK

Phase 5 is locked. Do not touch the ICP tenant until Richard provides the unlock passcode in #dax-collab.

---

## Rules

1. All work in DAX-Dev environment — never touch dax.dakona.com until Phase 4
2. Test every tool individually after building it
3. SharePoint writes go to `DAX-Dev/` subfolder — not production DAX Documents
4. Azure OpenAI is shared — prefix dev system prompt with [DEV] to identify dev traffic
5. Never expose Direct Line secret in client-side JavaScript — always proxy through a backend
6. Tag Richard at end of Phase 3 with T6 results before doing anything in Phase 4
7. Post progress to #dax-collab after each major step
8. If blocked on Power Platform licensing or environment creation — tag Richard immediately, do not guess

---

## Reference Files
- `/repo/docs/DEPLOYMENT-PIPELINE.md` — release pipeline rules
- `/repo/docs/tasks/TASK-20260429-001-Graph-SDK-Migration.md` — parallel task (Graph SDK)
- `/repo/clients/impact-capital/params.json` — ICP configuration
- `/repo/n8n/snapshots/2026-04-29/` — n8n workflow backups on n8n VM
- `/repo/docs/PO-BRIEF.md` — full project context
