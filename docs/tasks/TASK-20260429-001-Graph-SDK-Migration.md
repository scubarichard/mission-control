# TASK-20260429-001 — Microsoft Graph SDK Migration
**Assigned to:** Forge / Nautilus  
**Priority:** High — must complete before dax.impact-cp.com deployment  
**Environment:** dax.dakona.com (Dakona pilot) first, then dax.impact-cp.com  
**Verification:** T6 test suite must pass 7/7 after each phase  
**Report to:** #dax-collab when each phase is complete or blocked  

---

## Why This Task Exists

Today (2026-04-29) we discovered that 6 DAX tools were silently broken because:
1. An n8n upgrade blocked `process.env` and `process` globals in Code nodes
2. Raw Node.js HTTPS calls do not follow HTTP 302 redirects (required by SharePoint)
3. URL path encoding inconsistencies between Graph API endpoints
4. Hardcoded values that were wiped by a blanket find/replace fix

All of these failures are solved by switching from raw HTTPS calls to the Microsoft Graph SDK, and from custom Code nodes to n8n native nodes where possible.

This must be completed on dax.dakona.com and verified before any deployment to dax.impact-cp.com.

---

## System Context

### Current Architecture
- LibreChat at dax.dakona.com — user interface
- n8n at n8n.dakona.net — all tool execution
- DAX Router workflow ID: `3tniyxZREqfnAbfo`
- DAX Research & Write workflow ID: `2eNUFkeZf0jsEHcq`
- DAX Document Generator workflow ID: `MtkxBYcyV1VYt02e`
- n8n VM: `n8n.dakona.net` in resource group `dk-n8n_group`
- Dev VM: `vm-dax-dev` at `172.16.0.5` in `dk-n8n_group`

### Credentials (all tools use these — do not change)
- Tenant ID: `d2a3c346-00f3-47dd-a53e-caa3fca74714`
- Client ID: `218064ac-bee2-4246-9709-ae7518ae71cb`
- Client Secret: in Dakona Key Vault as `DAX-Client-Secret`
- SharePoint Site ID: `dakonallc.sharepoint.com,68764500-f333-44cc-8017-30489a6a9053,71b1b423-6196-4e05-b004-7298445afb6f`
- Azure OpenAI: `oai-dax-dakona-pilot.openai.azure.com` / deployment `gpt-4o`

### DAX Folder Structure in SharePoint
- `DAX Documents` — articles, scripts, general files
- `DAX Reports` — client quarterly reviews
- `DAX Templates` — document templates including `Quarterly-Review-TEMPLATE.docx`
- `DAX Uploads` — user-uploaded files
- `Schwab Exports` — Schwab DDF data files

### Tools Currently in DAX Router (28 nodes)
- Email Tool — reads advisor inbox via Graph
- Send Email Tool — sends email via Graph
- Calendar Tool — reads calendar via Graph
- Manage Calendar Tool — creates/updates calendar events via Graph
- Meeting Prep Tool — pulls Wealthbox + portfolio data
- Create Document Tool — saves files to SharePoint DAX Documents
- SharePoint Browser Tool — lists and reads files from SharePoint (NEW — added today)
- Client Lookup Tool — searches Wealthbox contacts
- List Clients Tool — lists all Wealthbox clients
- Generate Reports Tool — triggers Schwab report generation
- Market Data Tool — live prices via FMP/Finnhub
- Market Summary Tool — market news summary
- Research and Write Tool — triggers long-form article generation
- Compliance Flag Check — Reg BI compliance monitoring
- GitHub Tool — code repository access

---

## Phase 1 — Install Microsoft Graph SDK on n8n VM

**Why:** The SDK handles auth token caching, redirect following, retry logic, and URL encoding automatically. Eliminates the entire class of bugs seen today.

**Steps:**

```bash
# SSH to n8n VM
ssh dkn8n@n8n.dakona.net  # or via Cloudflare Access

# Install Graph SDK globally so n8n Code nodes can require it
sudo npm install -g @microsoft/microsoft-graph-client node-fetch

# Verify
node -e "const { Client } = require('@microsoft/microsoft-graph-client'); console.log('Graph SDK OK');"
```

**If global install does not work in n8n sandbox:**
Install in n8n's node_modules directory:
```bash
cd /usr/lib/node_modules/n8n
sudo npm install @microsoft/microsoft-graph-client node-fetch
```

**Verification:** Run this in an n8n Code node to confirm:
```javascript
const { Client } = require('@microsoft/microsoft-graph-client');
return [{ json: { status: 'Graph SDK available' } }];
```

If require fails, the SDK is not accessible from n8n sandbox. In that case proceed to Phase 1b.

**Phase 1b (fallback if SDK unavailable in sandbox):**
Build a shared Graph helper as an n8n sub-workflow that all tools call via Execute Workflow node. The sub-workflow handles auth, redirect following, and encoding. Individual tools pass endpoint + method + body, get back clean JSON.

---

## Phase 2 — Rebuild SharePoint File Tools

### 2a — SharePoint Browser Tool (already added, needs SDK upgrade)

Current node: `SharePoint Browser Tool` in DAX Router  
Current issue: HTTP 302 redirect on file read — fixed with download URL workaround but fragile

**New implementation using SDK:**
```javascript
const { Client } = require('@microsoft/microsoft-graph-client');
require('node-fetch'); // polyfill for SDK

const client = Client.init({
  authProvider: async (done) => {
    // Get token via client credentials
    const res = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials'
      })
    });
    const data = await res.json();
    done(null, data.access_token);
  }
});

// List files — SDK handles encoding automatically
const files = await client.api(`/sites/${SITE_ID}/drive/root:/DAX Documents:/children`)
  .select('name,size,lastModifiedDateTime,id,webUrl')
  .orderby('lastModifiedDateTime desc')
  .top(50)
  .get();

// Read file content — SDK follows redirects automatically
const content = await client.api(`/sites/${SITE_ID}/drive/items/${itemId}/content`).get();
```

**Capabilities to implement:**
- `list [folder]` — list files in DAX Documents / Reports / Templates / Schwab Exports
- `search [keyword]` — filter by filename keyword
- `read [number or partial name]` — read file content, return first 4000 chars
- `summarize [number or partial name]` — read and summarize via GPT-4o

### 2b — Create Document Tool

Current issue: siteId was wiped to empty string by process.env fix, URL encoding inconsistent

**Rebuild requirements:**
- Use Graph SDK for upload
- Accept: title, content, filename, extension (default .txt), folder (default DAX Documents)
- Sanitize filename — strip special chars, max 80 chars
- Return: SharePoint web URL of saved file
- Handle: file already exists (use conflict behavior rename)

### 2c — Document Generator (MtkxBYcyV1VYt02e)

Current issue: pizzip runs in subprocess (workaround for n8n sandbox) — fragile

**Options (pick one):**
1. Keep subprocess pattern but add error handling and retry logic
2. Move docx generation to an Azure Function (fn-dax-docgen) — this is the v0.6 roadmap item
3. Use LibreOffice on vm-dax-dev for HTML-to-docx conversion

**Recommended:** Keep subprocess for now, add proper error handling. Flag if Azure Function approach is preferred.

---

## Phase 3 — Rebuild Email and Calendar Tools

### Current issues
- `process.env` references were replaced with hardcoded strings (working but messy)
- No per-user OAuth — all email reads from rmabbun@dakona.com service account
- Calendar creates events as the service account, not the advisor

### 3a — Email Tool rebuild

**Requirements:**
- Use Graph SDK
- Read from advisor's mailbox (use `advisorEmail` variable passed from DAX Agent)
- Support: list inbox, list unread, search by sender, search by subject, read specific email
- Return: structured list with subject, from, date, preview, read status
- Current advisor email: `rmabbun@dakona.com` (hardcoded default, will be per-user in v0.6)

### 3b — Send Email Tool rebuild

**Requirements:**
- Use Graph SDK
- Send from advisor's mailbox (delegated) or DAX service account
- Support: to, cc, subject, body (plain text and HTML)
- Require explicit confirmation in system prompt before sending

### 3c — Calendar Tool rebuild

**Requirements:**
- Use Graph SDK
- Read advisor's calendar
- Support: list today's events, list this week, search by keyword, read event details
- Return: structured event list with time, title, attendees, location

### 3d — Manage Calendar Tool rebuild

**Requirements:**
- Use Graph SDK
- Create, update events on advisor's calendar
- Require explicit confirmation before creating/modifying

---

## Phase 4 — Add Monitoring and Alerting

**Why:** Today's tool failures were silent — nobody knew until a user hit them.

### 4a — DAX Health Check workflow

Create new n8n workflow: `DAX Health Check`
- Runs every 30 minutes via cron trigger
- Tests each tool with a simple ping:
  - Email Tool: list 1 email from inbox
  - SharePoint Browser Tool: list DAX Documents
  - Market Data Tool: get SPY price
  - Calendar Tool: list today's events
  - Create Document Tool: write a test file and delete it
- On failure: post to #dax-collab Slack with tool name and error
- Slack channel ID: `C0APVGG486M`

### 4b — n8n version lock

```bash
# Check current n8n version
n8n --version

# Pin version in package.json — do not auto-upgrade
# Document the pinned version in /repo/docs/DEPLOYMENT-PIPELINE.md
```

Add to deployment pipeline: n8n version must match between dev, staging, and production.

---

## Phase 5 — Prepare ICP Deployment Package

After Phases 1-4 are complete and T6 passes 7/7 on dax.dakona.com:

### 5a — Create ICP configuration

ICP credentials are already in Dakona Key Vault:
- `ICP-TenantId`: `eaf1a864-97ff-451c-87e7-88cf7512e98c`
- `ICP-SubscriptionId`: `e1c109d7-9232-4e26-bed7-b1e1b5a6f611`
- `ICP-ClientId`: `213f104f-c25b-4ccd-bf3c-d6f441384a77`
- `ICP-ClientSecret`: `OLX8Q~Ei8DkLia2FCXzV~fgkBr3NWn~Zsaa1YbHR`

ICP SharePoint:
- Site URL: `https://impactcapitalpartnersllc.sharepoint.com/sites/ImpactCapitalPartners`
- Site ID: `impactcapitalpartnersllc.sharepoint.com,9408138e-0aa3-404e-b131-bc905b2d99d0,40e05979-6387-4bb6-8b8e-6638aa9c1e2f`

ICP params file: `/repo/clients/impact-capital/params.json`

### 5b — What changes between Dakona and ICP

Every tool that references Dakona credentials needs a per-client credential swap:

| Variable | Dakona value | ICP value |
|---|---|---|
| Tenant ID | d2a3c346-... | eaf1a864-... |
| Client ID | 218064ac-... | 213f104f-... |
| Client Secret | 6LR8Q~... | OLX8Q~... |
| SharePoint Site ID | dakonallc.sharepoint.com,... | impactcapitalpartnersllc.sharepoint.com,... |
| Advisor Email | rmabbun@dakona.com | brett@impact-cp.com |
| Azure OpenAI endpoint | oai-dax-dakona-pilot... | (new instance in ICP tenant) |

**The provisioner (New-DAXClient.ps1) must inject these per-client values at deploy time.**

### 5c — ICP-specific tool configuration

For beta ICP deployment:
- Wealthbox: NOT connected (no API key yet)
- Schwab: NOT connected (no DDF setup yet)
- Email: brett@impact-cp.com mailbox
- Calendar: brett@impact-cp.com calendar
- SharePoint: impactcapitalpartnersllc.sharepoint.com
- Azure OpenAI: deploy new instance in ICP Azure subscription

### 5d — ICP verification checklist

Run after deployment, before handing to Brett:
```
[ ] dax.impact-cp.com loads and SSO works with brett@impact-cp.com
[ ] "Good morning" → DAX responds
[ ] "What is SPY trading at today?" → returns live price
[ ] "Show me what files are in my DAX Documents folder" → lists ICP SharePoint
[ ] "Write a short article about retirement planning and save it" → saves to ICP SharePoint
[ ] "Read my last 2 emails" → reads brett@impact-cp.com inbox
[ ] "What's on my calendar today?" → reads brett@impact-cp.com calendar
[ ] Document saved to SharePoint → appears in ICP SharePoint DAX Documents
[ ] No Dakona data visible to Brett
[ ] No ICP data visible in Dakona pilot
```

---

## Execution Order

```
Phase 1 — Install Graph SDK on n8n VM         (30 min)
Phase 2a — SharePoint Browser Tool rebuild    (2 hrs)
Phase 2b — Create Document Tool rebuild       (1 hr)
Phase 3a — Email Tool rebuild                 (2 hrs)
Phase 3b — Send Email Tool rebuild            (1 hr)
Phase 3c/d — Calendar Tools rebuild           (2 hrs)
Run T6 on dax.dakona.com — must be 7/7 PASS
Phase 4a — Health Check workflow              (2 hrs)
Phase 4b — n8n version lock                  (30 min)
Phase 2c — Document Generator hardening      (2 hrs)
Run T6 again — must be 7/7 PASS
Richard approves staging
Phase 5 — ICP deployment package             (3 hrs)
Deploy to dax.impact-cp.com
Run ICP verification checklist
Tag release: git tag v0.6.0
```

**Total estimated time: 2-3 days**

---

## Rules

1. Test every tool after rebuilding it — do not batch test at the end
2. If Graph SDK is unavailable in n8n sandbox, use the shared sub-workflow pattern (Phase 1b) — do not go back to raw HTTPS calls
3. Never hardcode credentials in workflow code — use n8n credential store or Key Vault references
4. Do not deploy anything to ICP until T6 passes 7/7 on dax.dakona.com
5. Post progress updates to #dax-collab after each phase
6. Tag Richard if blocked — do not guess on architecture decisions

---

## Reference Files
- `/repo/clients/impact-capital/params.json` — ICP configuration
- `/repo/docs/DEPLOYMENT-PIPELINE.md` — release process
- `/repo/n8n/dax-router-current.json` — current router backup
- `/repo/docs/PO-BRIEF.md` — full project context
