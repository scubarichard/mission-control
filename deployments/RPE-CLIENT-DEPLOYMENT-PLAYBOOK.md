# RPE Systems — Client Deployment Playbook

**Estimated time:** 3–5 hours (automated phases ~45min, manual steps ~2–4hrs)
**First deployed:** AJ Flooring Solutions, 2026-04-03
**Deployer:** Forge agent

---

## Prerequisites

Before starting, ensure you have:

- [ ] GHL subaccount created with PIT token (all scopes enabled)
- [ ] GHL Location ID (from URL: `app.gohighlevel.com/v2/location/{LOCATION_ID}/launchpad`)
- [ ] ClickUp workspace access (RPE Systems team ID: `9017745115`)
- [ ] n8n folder created for the client at `n8n.dakona.net`
- [ ] RPE Slack workspace bot token (`rpe-slack-token` in kv-seed.json)
- [ ] GitHub token with repo access (`github-token` in kv-seed.json)
- [ ] Google Drive/Sheets OAuth credentials configured in n8n

---

## Phase 1A — GHL Custom Fields + Pipeline (~10min automated + 5min manual)

### Automated
Run `scripts/deploy-phase1a.mjs` — creates 16 custom fields on opportunities:

| Field | Type |
|-------|------|
| Labor Budget, Crew Payout, Gross Margin %, Material Cost, Labor Cap %, Material Order Total | Numerical |
| Product Type, ClickUp Task ID, ClickUp Short ID, Completion Date, Material SKU, Order Date, Crew | Text |
| Photos Uploaded, Signed Off, Go-Back Required | Checkbox (options: Yes/No) |

### Manual — Pipeline Creation
**GHL PIT tokens cannot create pipelines** (returns 401 regardless of scopes). Create manually:

1. Open GHL → Opportunities → Pipelines → Create Pipeline
2. Name: `{Client Name} Pipeline`
3. Stages (in order):
   - New Lead (Blue)
   - Estimate Sent (Orange)
   - Contract Signed (Purple)
   - In Production (Yellow)
   - Closed Won (Green)
   - Margin Review (Red)
4. Save, then run the pipeline ID retrieval script to capture IDs

**Alternative:** Complete GHL OAuth setup (app in Draft, credentials in kv-seed.json) to automate this.

---

## Phase 1B — ClickUp Space + Folders + Lists (~5min automated)

Run `scripts/deploy-phase1b.mjs` — creates:

- **Space:** `{Client Name}`
- **Folders:** Active Jobs, Completed Jobs, Change Orders, Dashboard Development
- **Lists:** Current Pipeline, Starting This Week, Completed, Pending COs, Approved COs, Backlog, In Progress

Custom fields are **workspace-level** (shared from Flooring Operations space) — no need to recreate. Existing fields:
- GHL Opportunity ID, Contract Value, Gross Margin Percent, Labor Budget, Crew Payout, Crew Assigned, Material SKU, Project Type, Total Sq Ft, Install Date

**Note:** If ClickUp custom fields fail with "ClickApp not enabled", the workspace may need a paid plan. The existing workspace-level fields still work across spaces.

---

## Phase 1C — Google Sheet (~2min automated)

Run `scripts/deploy-phase1c.mjs` — uses n8n Google Drive OAuth to:

1. Create `RPE Clients/` folder (if not exists)
2. Create `{Client Name}/` subfolder
3. Copy template sheet `1R7ICwjWEEO_FGzAxMtq0fR7ey6TSlpPjbSdPLQ264yg`
4. Name: `{Client Name} — Operations Dashboard`

**Important:** After copy, clear all 5 tabs of template sample data:
- Raw_Jobs, CEO_View, GM_View, Controller_View, Change_Orders
- Headers only — clear rows 2+

---

## Phase 2A — Build ID Map (~1min automated)

Run `scripts/deploy-phase2a.mjs` — consolidates all IDs into a placeholder map (62+ placeholders). Verify 0 missing before proceeding.

---

## Phase 2B — Deploy 12 n8n Workflows (~5min automated)

Run `scripts/deploy-phase2b.mjs` — fetches templates from `scubarichard/rpe-workflow-templates`, hydrates with client IDs, deploys to n8n.

### Workflows deployed:
| # | Workflow | Webhook |
|---|----------|---------|
| v01 | Margin Guardrail | `/{slug}-v01` (POST) |
| v02 | Labor Cap Monitor | `/{slug}-v02` (POST) |
| v03 | Field Validation Gate | `/{slug}-v03` (POST) |
| v04 | Job Completion | `/{slug}-v04` (POST) |
| v05 | Material Order | `/{slug}-v05` (POST) |
| v06 | Change Order Sync | `/{slug}-v06` (POST) |
| v07 | Payout Gate | `/{slug}-v07` (POST) |
| v08 | CO Paid Recalc | `/{slug}-v08` (POST) |
| v09 | Dashboard Feed | `/{slug}-v09-run` (POST) — scheduled daily 6:10 AM + manual trigger |
| v10 | Dashboard Feed GHL | `/{slug}-v10` (GET) |
| v11 | Dashboard Live JSON | `/{slug}-v11` (GET) |
| v12 | Signoff Receiver | `/{slug}-signoff` (POST) |

### Post-deploy:
- Move all `[{PREFIX}]` workflows into the client's n8n folder
- Run v09 manually to initialize the sheet with empty data

---

## Phase 3 — GitHub Pages Dashboard (~3min automated)

Run `scripts/deploy-phase3.mjs` — creates repo, injects CONFIG, enables Pages.

- Dashboard: `https://scubarichard.github.io/{slug}-dashboard/`
- Views: `?view=ceo`, `?view=gm`, `?view=cfo`
- Signoff: `/{slug}-dashboard/signoff.html`

**Note:** The source template (`rpe-dashboard/index.html`) now has zeroed sample data and `{{placeholder}}` CONFIG. The deploy script handles hydration.

---

## Phase 4 — Deployment Manifest (~1min automated)

Run `scripts/deploy-phase4.mjs` — commits JSON + MD build notes to `scubarichard/rpe-systems/deployments/{slug}.json` and `{slug}.md`.

---

## Manual Steps (Post-Automation) — ~2-4 hours

### 1. Apply GHL Snapshot (~15min)
The template snapshot contains dashboards, widgets, calendars, and internal workflows that can't be created via API.

1. Switch to **Agency view** in GHL
2. Left sidebar → **Account Snapshots**
3. Find `RPE_Flooring_Operations_v1`
4. Click 3 dots → **Push to Sub-Account** → select client subaccount
5. **Select:** Brand Colors, Calendars, Custom Fields, Custom Values, Dashboards, Knowledge Bases, Review Settings, Tags, Workflows
6. **Skip:** Pipelines (already created manually)
7. Confirm and apply

### 2. Set GHL Custom Values (~5min)
Run via API or set manually:
- **Labor Cap Percent** → client's labor cap (e.g., 15)
- **Min Margin Percent** → client's margin target (e.g., 40)

### 3. Configure GHL Dashboard iFrame (~10min)
1. Open client subaccount → Reporting → Dashboards
2. Set the shared dashboard as **default for everyone**
3. Delete the 2 system default dashboards
4. Edit iFrame widget URL → `https://scubarichard.github.io/{slug}-dashboard/?view=ceo`

### 4. Update GHL Internal Workflow Webhooks (~20min)
The snapshot imports 5 GHL internal workflows with template webhook URLs. Update each:

| GHL Workflow | n8n Webhook URL |
|-------------|-----------------|
| Stage Change → n8n | `https://n8n.dakona.net/webhook/{slug}-v01` |
| Field Validation Gate → n8n | `https://n8n.dakona.net/webhook/{slug}-v03` |
| Job Completion → Make | `https://n8n.dakona.net/webhook/{slug}-v04` |
| Speed-to-Lead | No change (GHL internal) |
| Formula Flow Archive | Draft — skip |

### 5. Update GHL Workflow Filters (~15min)
Each GHL workflow trigger needs its filter set to the **client's pipeline**:
- Open each workflow → trigger step → select client's pipeline from dropdown
- Stage filters: reselect from the client's stage list

### 6. Clear Google Sheet Sample Data (~5min)
If not already cleared, use the Sheets API or manually clear rows 2+ on all 5 tabs.

### 7. Run v09 Dashboard Feed (~2min)
Trigger `https://n8n.dakona.net/webhook/{slug}-v09-run` (POST) to initialize the sheet with current (empty) GHL data.

### 8. Verify Dashboard (~10min)
- Hit `https://scubarichard.github.io/{slug}-dashboard/` — all views should show zeros
- Check CEO, GM, CFO views — no stale template data
- If charts show old values, the source template may need updating (see Known Issues)

### 9. Test Signoff Form (~10min)
Create a test opportunity in GHL → move to Closed Won → use signoff form → verify it posts to the v12 webhook.

### 10. Client-Specific Config (when provided)
- Update crew names in CONFIG (dashboard repo + n8n workflows)
- Update headcount
- Custom domain setup (optional)

---

## Known Issues

| Issue | Workaround |
|-------|-----------|
| GHL PIT tokens can't create pipelines | Create manually or complete OAuth setup |
| n8n Code nodes don't have global `fetch` | All templates use `require('https')` — fixed in repo |
| n8n Code nodes don't have `URL` class | Use `require('url').parse()` instead |
| n8n Code nodes don't have `crypto` | Use `require('crypto')` |
| Google Sheet `gviz/tq` endpoint needs published sheet | v11 uses Sheets OAuth API instead |
| Dashboard template had hardcoded sample data | Source template now zeroed with `{{placeholders}}` |
| GHL snapshot doesn't always copy dashboards | Share dashboard from template subaccount manually |
| Cloudflare WAF blocks large MCP server responses | Use `.mjs` script files on MCP server instead of inline PowerShell |

---

## Key Files

| File | Purpose |
|------|---------|
| `scripts/deploy-phase1a.mjs` | GHL custom fields |
| `scripts/deploy-phase1b.mjs` | ClickUp space/folders/lists |
| `scripts/deploy-phase1c.mjs` | Google Sheet copy |
| `scripts/deploy-phase2a.mjs` | ID map builder |
| `scripts/deploy-phase2b.mjs` | n8n workflow deployment |
| `scripts/deploy-phase3.mjs` | GitHub Pages dashboard |
| `scripts/deploy-phase4.mjs` | Deployment manifest |
| `scripts/preflight-aj.mjs` | Pre-flight check runner (template for new clients) |
| `scripts/deploy-state.json` | Running state file with all IDs |
| `scripts/kv-seed.json` | Credentials (⚠️ needs to be moved out of repo) |
| `scripts/rebuild-dashboard.mjs` | Clean rebuild dashboard from template |
| `deployments/{slug}.json` | Deployment manifest (machine) |
| `deployments/{slug}.md` | Build notes (human) |

---

## Credentials Required

| Key | Source | Used by |
|-----|--------|---------|
| Client PIT token | GHL subaccount → Private Integrations | Phases 1A, 2B, snapshots |
| Template PIT token | GHL template location → Private Integrations | Snapshot capture |
| ClickUp API token | `clickup-api-key` in kv-seed | Phase 1B |
| GitHub token | `github-token` in kv-seed | Phases 2B, 3, 4 |
| n8n API key | `n8n-api-key` in kv-seed | Phases 2B, workflow management |
| RPE Slack bot token | `rpe-slack-token` in kv-seed | Slack notifications |
| Google Sheets OAuth | n8n credential `fhAvmmHWXh2VIsWu` | Phases 1C, v09, v11 |
| Google Drive OAuth | n8n credential `0MjijtGwtAOKVNBE` | Phase 1C |

---

*First deployment: AJ Flooring Solutions — 2026-04-03*
*Playbook author: Forge agent*
*Total automated phases: ~45 minutes*
*Total manual steps: ~2-4 hours*
*End-to-end: ~3-5 hours*
