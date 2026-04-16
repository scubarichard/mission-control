# DAX — Three-Stage Deployment Pipeline Plan
**Created:** 2026-04-16  
**Author:** Richard Mabbun / Sonnet  
**Status:** APPROVED — send to Forge for implementation

---

## Overview

This document defines the full three-stage deployment pipeline for DAX. The goal is to ensure that no untested code ever reaches a client environment, and that any new client deployment is a repeatable, scripted, one-command operation.

---

## The Three Environments

| Environment | URL | Azure Tenant | Purpose |
|---|---|---|---|
| **Dev** | dev-dax.dakona.com | Dakona (rg-dax-dev) | Forge/Triton build here. Break things freely. |
| **Staging** | dax.dakona.com | Dakona (rg-dax-dakona-pilot) | Current pilot. T6 must pass before any release. Richard signs off here. |
| **Production** | per-client URL | Client tenant | Live client environment. Deployed from a tagged release only. |

---

## The Pipeline

```
[Dev]
  Forge/Triton make changes
  Unit test locally
  Push to dev branch
        ↓
[Staging]
  Merge dev → main
  Deploy to dax.dakona.com
  Run T6 test suite (must be 7/7 PASS)
  Richard reviews and signs off
  Tag release: git tag v0.X.Y
        ↓
[Production]
  Run: New-DAXClient.ps1 -client impact-capital -release v0.X.Y
  Deploys tagged release to client tenant
  Run verification checklist
  Notify client
```

---

## Environment Specs

### Dev Environment (new — needs to be built)

**Azure resources (in rg-dax-dev, Dakona subscription):**
- Container App: `ca-dax-dev` — LibreChat, same image as staging
- n8n instance: separate VM or container, `dev-n8n.dakona.net`
- Cosmos DB: `cosmos-dax-dev` (free tier)
- Azure OpenAI: shared with staging (same `oai-dax-dakona-pilot` endpoint)
- No Key Vault needed — use env vars directly in dev

**Access:** Forge, Triton, Richard only. Not client-facing.  
**URL:** `dev-dax.dakona.com` (Cloudflare DNS → Container App)  
**Cost:** ~$60-80/mo (can be stopped between dev sessions to save cost)

---

### Staging Environment (exists — dax.dakona.com)

**Current state:** This is the Dakona pilot. It IS staging.  
**Changes needed:**
- Enforce: no direct changes to staging without going through dev first
- T6 test suite must pass before any release tag is created
- Richard is the only approver for staging → production promotion

**Cost:** ~$100/mo (already running)

---

### Production Environments (per client)

**Each client gets:**
- Their own Azure tenant (or resource group if MSP-managed)
- Their own LibreChat container app
- Their own Cosmos DB
- Their own Azure OpenAI instance
- Their own SharePoint libraries
- Their own Entra app registration

**Deployed via:** `New-DAXClient.ps1 -client <name> -release <tag>`  
**Updated via:** `Update-DAXClient.ps1 -client <name> -release <tag>`

---

## Release Process (step by step)

### When Forge/Triton complete a feature or fix:

**Step 1 — Dev testing**
```
- Make changes in dev environment (dev-dax.dakona.com)
- Test the specific feature manually
- Confirm no regressions on other tools
- Push code to dev branch in git
```

**Step 2 — Promote to Staging**
```
- Merge dev branch → main
- Export updated n8n workflows to /repo/n8n/live-exports/
- Deploy to dax.dakona.com (Dakona pilot)
- Run: node scripts/run-tests.js --tier6-only
- Must be 7/7 PASS
- If any test fails → back to dev, do not proceed
```

**Step 3 — Richard sign-off**
```
- Richard reviews staging manually
- Checks: document generation, market data, client lookup, meeting prep
- Approves in #dax-collab: "Staging approved — ready to tag"
```

**Step 4 — Tag the release**
```
git tag -a "v0.X.Y" -m "Release notes here"
git push origin --tags
```

**Step 5 — Deploy to client(s)**
```
.\New-DAXClient.ps1 -client impact-capital -release v0.X.Y
.\Update-DAXClient.ps1 -client impact-capital -release v0.X.Y  (for existing clients)
```

**Step 6 — Client verification**
```
- Run verification checklist (see below)
- Confirm with client that everything works
- Post release notes to dax@dakona.com
```

---

## Provisioner Scripts (to be built by Forge)

### New-DAXClient.ps1
**Purpose:** Deploy a brand new DAX instance into a client's Azure tenant.  
**Input:** `-client <shortname>` `-release <tag>`  
**Reads:** `clients/<shortname>/params.json`  
**Does:**
1. Authenticate to client tenant using DAX-Deploy SP from Dakona KV
2. Create resource group
3. Deploy Cosmos DB
4. Deploy Azure OpenAI (gpt-4o)
5. Deploy Key Vault, store client secrets
6. Deploy Container App (LibreChat at specified release tag)
7. Register Entra app for SSO
8. Create SharePoint libraries (DAX Templates, DAX Reports, DAX Documents)
9. Copy Quarterly-Review-TEMPLATE.docx from Dakona SP to client SP
10. Import n8n workflows from release tag, set per-client credentials
11. Run verification checklist automatically
12. Output: deployment summary with URLs and status

### Update-DAXClient.ps1
**Purpose:** Update an existing client to a new release.  
**Input:** `-client <shortname>` `-release <tag>`  
**Does:**
1. Pull new LibreChat image for the release tag
2. Update Container App image
3. Export and reimport updated n8n workflows
4. Run verification checklist
5. Output: update summary

---

## Verification Checklist (post-deployment)

Run these manually or via the T6 script after every deployment:

```
[ ] DAX chat loads at client URL
[ ] SSO login works with client Entra account
[ ] "Good morning" → gets a response
[ ] "What is SPY trading at today?" → returns live price
[ ] "Show me my clients who are interested in ESG investing" → returns list (or graceful no-results if no Wealthbox)
[ ] "Generate Q1 reviews from my Schwab file" → generates docs to SharePoint (or graceful error if no Schwab)
[ ] "Write a 500 word article about interest rates and save it" → saves to SharePoint
[ ] SharePoint DAX Reports folder exists and is accessible
[ ] SharePoint DAX Templates folder has Quarterly-Review-TEMPLATE.docx
```

---

## Client Registry

| Client | Short Name | Status | Release | Tenant ID |
|---|---|---|---|---|
| Dakona (staging) | dakona-pilot | LIVE | v0.5.3 | d2a3c346-... |
| Impact Capital Partners | impact-capital | PENDING | v0.5.3-deployable | eaf1a864-... |

Add new clients to `clients/<shortname>/params.json` before running provisioner.

---

## Cost Summary

| Environment | Monthly Cost | Notes |
|---|---|---|
| Dev | ~$70/mo | Can stop between sessions → ~$30/mo if stopped nights/weekends |
| Staging (Dakona pilot) | ~$100/mo | Already running |
| ICP Production | ~$150/mo | On ICP's Azure bill, not Dakona's |
| **Dakona total** | **~$170/mo** | Dev + Staging only |
| **Per new client** | **~$150/mo** | On client's Azure bill |

---

## What Forge Needs to Build (priority order)

1. **Dev environment** — spin up `ca-dax-dev` + `dev-n8n.dakona.net` in `rg-dax-dev`
2. **New-DAXClient.ps1** — parameterized provisioner (ICP is first test)
3. **Update-DAXClient.ps1** — for pushing releases to existing clients
4. **PWA icon build** — 192x192, 512x512, 180x180 icons + container rebuild (v0.5.4-pwa)
5. **Release checklist doc** — simple 10-step process in the repo

---

## Rules (non-negotiable)

1. No direct changes to staging without going through dev first
2. T6 must be 7/7 PASS before any release tag
3. Richard must approve staging before any production deployment
4. Production always deploys from a git tag — never from main directly
5. Client data never touches Dakona infrastructure
6. All AI processing via client's own Azure OpenAI instance
