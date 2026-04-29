# TASK-20260429-002 — DAX Copilot Studio Migration
**Assigned to:** Nautilus  
**Priority:** High — parallel track to TASK-20260429-001  
**Dependencies:** TASK-20260429-001 (Graph SDK Migration) must reach T6 7/7 PASS before Phase 5  
**Report to:** #dax-collab after each phase  
**ICP Lock:** Phase 5 requires Richard's passcode — do not touch ICP until provided  
**ClickUp:** https://app.clickup.com/t/86e157vqf  

---

## Objective

Migrate DAX from its current LibreChat + n8n architecture to Microsoft Copilot Studio as the agent and front-end layer, with Power Automate replacing n8n for tool execution. The result is a more reliable, natively M365-integrated DAX that costs less per client and requires no VM management.

All work happens in a fully isolated dev environment first — dev.dax.dakona.com. Production (dax.dakona.com) is not touched until T6 passes and Richard approves. ICP (dax.impact-cp.com) is locked until Richard provides the unlock passcode.

---

## Current Architecture (what exists today)

```
User → dax.dakona.com (Cloudflare DNS)
         → LibreChat Container App (ca-dax-dakona-pilot)
             image: acrdaxdakona.azurecr.io/librechat-dax:v0.5.3-hotfix1
             replicas: 3
         → n8n VM (Standard_D2s_v5, n8n v2.14.2, n8n.dakona.net)
             27 active tool workflows
         → Azure OpenAI (oai-dax-dakona-pilot.openai.azure.com / gpt-4o)
         → Cosmos DB (cosmos-dax-dakona-pilot) — conversation history
         → SharePoint (dakonallc.sharepoint.com) — DAX Documents/Reports/Templates
         → MCP Container App (ca-dax-mcp-dakona-pilot, mcp.dakona.net)
```

**Current monthly cost (Dakona):** ~$140/mo  
**n8n VM D2s_v5 ~$75/mo** — shared with 1AltX, not a pure DAX cost

---

## Target Architecture

```
User → dev.dax.dakona.com → dax.dakona.com → dax.impact-cp.com
         → Azure Static Web App (custom chat UI — React + Bot Framework Web Chat)
             Direct Line secret injected server-side from Key Vault
             never exposed in client JS
         → Copilot Studio Agent (DAX)
             Power Platform environment: DAX-Dev / DAX-Staging / DAX-ICP
             Channel: Custom app via Direct Line API
             Model: Azure OpenAI gpt-4o (BYOM)
         → Power Automate Flows (15 tools)
             native M365 connectors for email/calendar/SharePoint
             HTTP actions for Wealthbox, FMP, Finnhub, GitHub
             proxy HTTP calls to n8n for Schwab + Document Generator
         → Azure OpenAI (oai-dax-dakona-pilot — same, shared)
         → Cosmos DB (cosmos-dax-dev — NEW, separate account for dev)
         → SharePoint (same libraries, DAX-Dev subfolder for dev)
         → Key Vault (kvdaxdakonapilot — same, new secrets added)
```

**Target monthly cost (Dakona DAX only):** ~$30-50/mo  
**n8n VM stays** for 1AltX client work — off DAX books entirely

---

## Architecture Principles (non-negotiable)

1. **Full environment isolation** — dev, staging, and production have completely separate infrastructure. No shared Cosmos DB accounts between environments. No shared Power Platform environments.

2. **Environment variables everywhere** — nothing environment-specific is hardcoded in any flow or agent configuration. Every value that changes between dev/staging/ICP is a Power Platform environment variable.

3. **GitHub as source of truth** — all solution exports, front-end code, deployment scripts, and config live in GitHub. Power Platform Build Tools auto-export solutions to git on every change.

4. **Secrets in Key Vault only** — Direct Line secrets, connection strings, API keys, client secrets never appear in git, never appear in client-side JavaScript, never appear in flow configuration as plain text.

5. **Promote, never redeploy** — code moves from dev → staging → production via Power Platform Pipeline promotion. Never rebuild in a higher environment.

---

## Where Files Live

### Power Platform (not in git directly)
```
make.powerapps.com → DAX-Dev environment
  Copilot Studio agent (DAX)
  Power Automate flows (15 tools)
  Environment variables (names + values)
  Connectors and connection references
```
These are managed by Microsoft. Exported to git automatically via GitHub Actions.

### GitHub (/repo — scubarichard/dax)
```
/repo/
  /frontend/
    /dev/              ← dev.dax.dakona.com source
      index.html
      app.js           ← Direct Line integration (secret from Key Vault)
      styles.css       ← DAX branding, dark navy #1F3864
    /staging/          ← dax.dakona.com (copied from dev on promotion)
    /icp/              ← dax.impact-cp.com (locked)
  /power-platform/
    /solutions/
      DAX-dev.zip      ← auto-exported by GitHub Action
      DAX-staging.zip  ← auto-exported on promotion
    /environment-vars/
      dev.json         ← variable NAMES only, no values
      staging.json
      icp.json
  /clients/
    /impact-capital/
      params.json      ← already exists
  /docs/tasks/
    TASK-20260429-002-Copilot-Studio-Migration.md
  /scripts/
    New-DAXClient.ps1  ← to be built
```

### Azure Key Vault (kvdaxdakonapilot — secrets only, never in git)
```
DAX-Dev-DirectLine-Secret        ← new
DAX-Staging-DirectLine-Secret    ← new on Phase 4
DAX-Dev-CosmosEndpoint           ← new
DAX-Client-Secret                ← existing
ICP-*                            ← existing, locked
```

### Azure Static Web Apps (one per environment)
```
stapp-dax-dev      → dev.dax.dakona.com
stapp-dax-staging  → dax.dakona.com (Phase 4)
stapp-dax-icp      → dax.impact-cp.com (Phase 5, ICP subscription)
```

---

## GitHub Actions Setup (Phase 1 requirement)

Install **Power Platform Build Tools** from GitHub Marketplace before writing any flows.

### Actions to configure:

**1. Export on change (dev branch)**
```yaml
# .github/workflows/export-dev-solution.yml
on:
  workflow_dispatch:  # manual trigger
  schedule:
    - cron: '0 */6 * * *'  # every 6 hours

jobs:
  export:
    uses: microsoft/powerplatform-actions
    # Export DAX solution from DAX-Dev environment
    # Commit to /repo/power-platform/solutions/DAX-dev.zip
```

**2. Deploy front end on push**
```yaml
# .github/workflows/deploy-frontend-dev.yml
on:
  push:
    paths: ['frontend/dev/**']

jobs:
  deploy:
    # az staticwebapp deploy → stapp-dax-dev
```

**3. Promote to staging (manual, requires Richard approval)**
```yaml
# .github/workflows/promote-to-staging.yml
on:
  workflow_dispatch:
    inputs:
      approved_by:
        description: 'Richard approval confirmation'
        required: true
```

---

## Environment Variables (all flows must use these)

Never hardcode these values. Define as Power Platform environment variables and reference in all flows.

| Variable Name | Dev value | Staging value | ICP value |
|---|---|---|---|
| `DAX_TENANT_ID` | d2a3c346-... | d2a3c346-... | eaf1a864-... |
| `DAX_CLIENT_ID` | 218064ac-... | 218064ac-... | 213f104f-... |
| `DAX_CLIENT_SECRET` | from KV | from KV | from KV |
| `DAX_SHAREPOINT_SITE_ID` | dakonallc.sharepoint.com,68764500-... | same | impactcapitalpartnersllc.sharepoint.com,9408138e-... |
| `DAX_SHAREPOINT_DOCS_FOLDER` | DAX-Dev | DAX Documents | DAX Documents |
| `DAX_ADVISOR_EMAIL` | rmabbun@dakona.com | rmabbun@dakona.com | brett@impact-cp.com |
| `DAX_FIRM_NAME` | Dakona [DEV] | Dakona | Impact Capital Partners |
| `DAX_COSMOS_ENDPOINT` | cosmos-dax-dev endpoint | cosmos-dax-dakona endpoint | cosmos-dax-icp endpoint |
| `DAX_OPENAI_ENDPOINT` | oai-dax-dakona-pilot... | oai-dax-dakona-pilot... | oai-dax-icp... |
| `DAX_DIRECTLINE_SECRET` | from KV DAX-Dev-DirectLine-Secret | from KV | from KV |

---

## Dev Environment Infrastructure

### New resources to create (Phase 1)

**1. Cosmos DB account — cosmos-dax-dev**
- Separate account from production (cosmos-dax-dakona-pilot)
- Resource group: rg-dax-dakona-pilot
- API: MongoDB (same as production)
- Capacity: Serverless
- Region: East US
- Cost: ~$1-3/mo at dev usage

Why separate: Environment isolation is non-negotiable for a compliance product. Sharing a Cosmos DB account between dev and production means a misconfigured connection string can write dev data to production. Full isolation eliminates this class of risk.

**2. Azure Static Web App — stapp-dax-dev**
- Resource group: rg-dax-dakona-pilot
- Region: East US
- SKU: Free
- Source: GitHub /repo/frontend/dev/
- Custom domain: dev.dax.dakona.com

**3. Power Platform environment — DAX-Dev**
- Type: Developer (free — no production credits consumed)
- Tenant: Dakona (d2a3c346-00f3-47dd-a53e-caa3fca74714)
- Region: United States
- Purpose: DAX Copilot Studio development

**4. Copilot Studio agent — DAX (in DAX-Dev)**
- Connected to Azure OpenAI gpt-4o via BYOM
- System prompt: copy from n8n DAX Router node DAX Agent → parameters.systemMessage
- Add prefix to system prompt: [DEV dev.dax.dakona.com] — identifies dev traffic
- Direct Line channel enabled
- Direct Line secret → Key Vault DAX-Dev-DirectLine-Secret

**5. DNS — Cloudflare**
- Add CNAME: dev.dax.dakona.com → stapp-dax-dev default domain
- Enable orange cloud proxy

---

## DAX System Prompt

Get the exact current system prompt from n8n:
- Workflow ID: 3tniyxZREqfnAbfo
- Node: DAX Agent
- Field: parameters.systemMessage

This is the authoritative system prompt. Copy it exactly into Copilot Studio agent Instructions. Do not paraphrase or rewrite — the compliance guardrails and tool routing instructions are carefully tuned.

Add this prefix for dev only:
```
[DEV — dev.dax.dakona.com] 
```

---

## Tools to Rebuild in Power Automate (15 total)

Build in this priority order. Test each individually before moving to the next. Post completion of each tool to #dax-collab.

| # | Tool | Power Automate approach | Test prompt |
|---|---|---|---|
| 1 | Market Data Tool | HTTP action → FMP API + Finnhub | "What is SPY trading at today?" |
| 2 | Email Tool | Microsoft 365 Outlook connector | "Read my last 2 emails" |
| 3 | Calendar Tool | Microsoft 365 Calendar connector | "What's on my calendar today?" |
| 4 | SharePoint Browser Tool | SharePoint connector | "Show me my DAX Documents" |
| 5 | Create Document Tool | SharePoint connector | "Write a note and save it" |
| 6 | Client Lookup Tool | HTTP action → Wealthbox API | "Find George Jetson" |
| 7 | List Clients Tool | HTTP action → Wealthbox API | "Show me my ESG clients" |
| 8 | Meeting Prep Tool | Compose: Client Lookup + SharePoint | "Prep me for George Jetson" |
| 9 | Send Email Tool | Microsoft 365 Outlook connector | "Draft an email to..." |
| 10 | Manage Calendar Tool | Microsoft 365 Calendar connector | "Schedule a meeting with..." |
| 11 | Market Summary Tool | HTTP action → Bing News | "What's driving markets?" |
| 12 | Research and Write Tool | Azure OpenAI connector + SharePoint | "Write 1000 words on..." |
| 13 | Compliance Flag Check | Custom logic + SharePoint log | "Should I put client in QQQ?" |
| 14 | Generate Reports Tool | HTTP action → n8n webhook (proxy) | "Generate Q1 reviews" |
| 15 | GitHub Tool | HTTP action → GitHub API | (internal use) |

### Proxy pattern for n8n tools (14 and Document Generator)
For tools that stay on n8n, use a Power Automate HTTP action:
```
POST https://n8n.dakona.net/webhook/schwab-processor
POST https://n8n.dakona.net/webhook/generate-document
```
Same webhooks as today — just called from Power Automate instead of n8n DAX Router.

### Wealthbox API
- Base URL: https://api.crmworkspace.com/v1
- API key: Key Vault WEALTHBOX-API-KEY
- Endpoints: /contacts (search, list), /tasks, /notes

### Graph API credentials
- Client ID: 218064ac-bee2-4246-9709-ae7518ae71cb (DAX app registration)
- Secret: Key Vault DAX-Client-Secret
- Scope: https://graph.microsoft.com/.default
- Use Power Automate HTTP action with manual OAuth2 or create custom connector

---

## Publish Pipeline (how promotion works)

### Dev → Staging (dax.dakona.com)
```
1. T6 passes 7/7 on dev.dax.dakona.com
2. Post results to #dax-collab, tag Richard
3. Richard reviews dev.dax.dakona.com manually
4. Richard approves in #dax-collab
5. Trigger GitHub Action: promote-to-staging.yml
6. Power Platform Pipeline exports solution from DAX-Dev
7. Imports managed solution to DAX-Staging environment
8. Set Staging environment variables (Dakona production values)
9. Deploy /repo/frontend/staging/ to stapp-dax-staging
10. Update Cloudflare: dax.dakona.com → stapp-dax-staging
11. LibreChat stays live 48 hours as fallback
12. Run T6 on dax.dakona.com — must pass
13. Decommission LibreChat container app
14. git tag v0.7.0
15. Post to #dax-collab
```

### Staging → ICP (dax.impact-cp.com) ⛔ LOCKED
```
1. Richard provides passcode in #dax-collab
2. Power Platform Pipeline exports solution from DAX-Staging
3. Imports managed solution to DAX-ICP environment in ICP tenant
   - ICP Power Platform env created using DAX-Deploy SP
   - Client ID: 213f104f-c25b-4ccd-bf3c-d6f441384a77
   - Tenant: eaf1a864-97ff-451c-87e7-88cf7512e98c
4. Set ICP environment variables (ICP values from params.json)
5. Deploy /repo/frontend/icp/ to stapp-dax-icp in ICP Azure subscription
6. DNS: dax.impact-cp.com → stapp-dax-icp
7. Run ICP verification checklist
8. Hand off to Brett
```

### For every future client
Same process — one Power Platform Pipeline command per client. Environment variables inject the client-specific values. The solution never changes — only the config does.

---

## Phase Execution

### Phase 1 — Dev environment setup (2-3 hours)

**Step 1 — GitHub Actions setup**
- Add Power Platform Build Tools to GitHub repo
- Configure export workflow (auto-export DAX-Dev solution every 6 hours)
- Configure front-end deploy workflow (deploy on push to frontend/dev/)
- Confirm both workflows run successfully before proceeding

**Step 2 — Provision dev infrastructure**
- Create cosmos-dax-dev (separate Cosmos DB account, serverless, MongoDB API)
- Create stapp-dax-dev (Azure Static Web App, free tier, linked to GitHub /repo/frontend/dev/)
- Store Cosmos DB connection string in Key Vault as DAX-Dev-CosmosEndpoint

**Step 3 — Create DAX-Dev Power Platform environment**
- make.powerapps.com → Environments → New → Developer → DAX-Dev
- Confirm environment appears in admin.powerplatform.microsoft.com

**Step 4 — Create Copilot Studio agent**
- copilotstudio.microsoft.com → DAX-Dev environment → New agent → DAX
- Configure Azure OpenAI BYOM connection to oai-dax-dakona-pilot
- Paste system prompt from n8n DAX Router (add [DEV] prefix)
- Enable Direct Line channel
- Store Direct Line secret in Key Vault as DAX-Dev-DirectLine-Secret

**Step 5 — Set all environment variables**
- Create all 10 environment variables in DAX-Dev with dev values
- Confirm no hardcoded values anywhere

**Step 6 — Deploy front-end shell**
- Create /repo/frontend/dev/ with minimal DAX-branded chat UI
- Bot Framework Web Chat component
- Direct Line secret fetched server-side from Key Vault (never in client JS)
- Dark navy #1F3864 branding
- Push to GitHub → GitHub Action deploys to stapp-dax-dev

**Step 7 — Configure DNS**
- Cloudflare: CNAME dev.dax.dakona.com → stapp-dax-dev default domain

**Step 8 — Verify basic chat**
- Open dev.dax.dakona.com
- Login with rmabbun@dakona.com
- Send: Good morning
- Confirm DAX responds with [DEV] prefix
- Post screenshot to #dax-collab ✅

---

### Phase 2 — Rebuild tools in Power Automate (1-2 days)

Build each tool in priority order (see table above).

For each tool:
1. Create Power Automate instant flow in DAX-Dev environment
2. Trigger: Copilot Studio (When an agent calls a flow)
3. Input: structured parameters from agent
4. Logic: call appropriate API using environment variables
5. Output: formatted text response back to agent
6. Register flow as action in Copilot Studio agent
7. Test in Copilot Studio test canvas
8. Post tool name + pass/fail to #dax-collab

Do not move to the next tool until the current one passes.

---

### Phase 3 — T6 verification on dev.dax.dakona.com (2-3 hours)

Run all tests against dev.dax.dakona.com (not the Copilot Studio test canvas).

**Original T6 prompts (must all pass):**
1. `Good morning`
2. `What is driving markets this morning?` then `What is SPY trading at today?`
3. `Show me my clients who are interested in ESG investing`
4. `Which of my clients have college planning as a goal?`
5. `Prep me for my meeting with George Jetson, the one with account 12345678`
6. `Should I put George Jetson into QQQ?` — must deflect, no investment advice
7. `Generate Q1 reviews from my Schwab file`
8. `Write a 1000 word article about the impact of rising interest rates on bond portfolios and save it`

**New tests (additional):**
9. `Show me what files are in my DAX Documents folder`
10. `Read my last 2 emails`
11. `What's on my calendar today?`
12. `Summarize file 1` (from file listing)

**Pass criteria:**
- All 7 original T6 tests pass
- All 4 new tests pass
- No silent failures — DAX must report errors clearly
- Files saved to DAX-Dev SharePoint subfolder (not production)
- Response quality matches or exceeds current LibreChat DAX

Post full results to #dax-collab and tag Richard. Do not proceed to Phase 4 without Richard's explicit approval.

---

### Phase 4 — Richard approval + staging promotion

**Requires Richard's explicit approval in #dax-collab.**

1. Richard reviews dev.dax.dakona.com personally
2. Richard posts approval in #dax-collab
3. Trigger promote-to-staging GitHub Action
4. Set DAX-Staging environment variables (Dakona production values)
5. Update Cloudflare: dax.dakona.com → stapp-dax-staging
6. Keep LibreChat live 48 hours as fallback
7. Run full T6 on dax.dakona.com
8. If T6 passes → decommission LibreChat (ca-dax-dakona-pilot)
9. git tag v0.7.0
10. Post to #dax-collab

---

### Phase 5 — ICP deployment ⛔ LOCKED

**Requires Richard's unlock passcode in #dax-collab.**

ICP tenant details (when unlocked):
- Tenant ID: eaf1a864-97ff-451c-87e7-88cf7512e98c
- Subscription: e1c109d7-9232-4e26-bed7-b1e1b5a6f611
- DAX-Deploy SP: 213f104f-c25b-4ccd-bf3c-d6f441384a77 (secret in KV as ICP-ClientSecret)
- SharePoint: impactcapitalpartnersllc.sharepoint.com/sites/ImpactCapitalPartners
- Advisor: brett@impact-cp.com
- Firm: Impact Capital Partners
- No Wealthbox (beta)
- No Schwab (beta)

**ICP verification checklist:**
```
[ ] dax.impact-cp.com loads
[ ] SSO works with brett@impact-cp.com
[ ] "Good morning" → DAX responds (no [DEV] prefix)
[ ] "What is SPY trading at?" → live price
[ ] "Show me my DAX Documents" → ICP SharePoint
[ ] "Write an article and save it" → saves to ICP SharePoint DAX Documents
[ ] "Read my last 2 emails" → brett@impact-cp.com inbox
[ ] "What's on my calendar?" → brett@impact-cp.com calendar
[ ] "Should I put a client in QQQ?" → compliance deflection
[ ] No Dakona data visible to Brett
[ ] No ICP data visible in Dakona environments
```

---

## What Stays on n8n (do not migrate)

| Workflow | Reason | How DAX calls it |
|---|---|---|
| Schwab DDF Processor | Complex, tested, leave alone | Power Automate HTTP action → n8n webhook |
| Document Generator (pizzip) | Complex docx templating | Power Automate HTTP action → n8n webhook |
| DAX Health Check | Being built in TASK-20260429-001 | Stays in n8n |
| All 1AltX client workflows | Not DAX — separate | Not touched |

---

## Cost Comparison

| | Current | After v0.7 | After v1.0 |
|---|---|---|---|
| Dakona DAX costs | ~$140/mo | ~$40-50/mo | ~$30-40/mo |
| Per client (their bill) | ~$150/mo | ~$50-80/mo | ~$30-60/mo |
| n8n VM | ~$75 (shared) | stays (1AltX) | stays (1AltX) |
| Copilot Studio | $0 | PAYG ~$10-30/mo | PAYG per client |

---

## Rules

1. GitHub Actions for Power Platform Build Tools must be configured in Phase 1 before any flows are built
2. All environment-specific values must be Power Platform environment variables — nothing hardcoded
3. cosmos-dax-dev must be a separate Cosmos DB account — not a database within cosmos-dax-dakona-pilot
4. Direct Line secret must never appear in client-side JavaScript — always fetched server-side from Key Vault
5. All SharePoint writes in dev go to DAX-Dev subfolder — never to production DAX Documents
6. Test every tool individually after building — no batch testing at end
7. Tag Richard after Phase 3 T6 results — do not proceed to Phase 4 without explicit approval
8. ICP is locked — do not touch until Richard provides passcode in #dax-collab
9. Post progress to #dax-collab after every major step
10. If blocked on Power Platform licensing, environment creation, or architecture decision — tag Richard immediately

---

## Reference
- Parallel task: TASK-20260429-001 (Forge — Graph SDK on current n8n stack)
- ICP params: /repo/clients/impact-capital/params.json
- Deployment pipeline: /repo/docs/DEPLOYMENT-PIPELINE.md
- n8n snapshots: /repo/n8n/snapshots/2026-04-29/ on n8n VM
- PO Brief: /repo/docs/PO-BRIEF.md
- ClickUp: https://app.clickup.com/t/86e157vqf
