# TASK QUEUE — Mission Control
# Agents poll for PENDING tasks assigned to them. Execute → mark DONE → write results to RESULTS/.

## TASK-1ALTX-001 through 007
STATUS: DONE
COMPLETED_DATE: 2026-04-12

## TASK-1ALTX-008
STATUS: DONE
COMPLETED_DATE: 2026-04-12
RESULTS_FILE: RESULTS/task_1altx_008_results.md

## TASK-1ALTX-009
STATUS: DONE
TITLE: Add Google Sheets button to trigger 7C for current row
COMPLETED_BY: FORGE
COMPLETED_DATE: 2026-04-12
RESULTS_FILE: RESULTS/task_1altx_009_results.md
NOTES: Apps Script ready. Richard pastes via Extensions → Apps Script. Adds "1AltX" menu → one-click 7C trigger for selected row. Cannot auto-deploy — manual paste required.

## TASK-1ALTX-010
STATUS: DONE
TITLE: PVC (Proposal Video Creator) Pipeline Handover
COMPLETED_BY: SONNET
COMPLETED_DATE: 2026-04-21
RESULTS_FILE: RESULTS/task_1altx_010_results.md
NOTES: Full pipeline built and documented. 97 videos rendered end-to-end (record → overlay → sheet). Scripts at C:\Users\18473\Tools\autovid-outreach\. Handover doc covers architecture, FFmpeg spec, deps, known issues (col V collision), and pending work items. Pipeline is Forge's to own going forward.

---

## TASK-20260417-FORGE-DAX-002 — DAX Error Monitoring System
- **Assignee:** Forge
- **Status:** DONE
- **Date:** 2026-04-17
- **Title:** Real-time error alerting for DAX (Dakona + ICP)

### Completed

**n8n — DAX Real-Time Error Monitor (FZE6DPjht00Espec)**
- Runs every 1 minute, queries both Log Analytics workspaces
- Uses timestamp-based deduplication (static data) — only alerts on new errors since last run
- Fires on first occurrence, not a count threshold — immediate detection
- Posts to Slack #alerts with workspace, container, timestamp, and full error text (250 chars)
- Active and confirmed running (3 executions verified)

**Auth setup**
- Dakona: SP a7be747e, tenant d2a3c346, Log Analytics Reader on law-dax-dakona-pilot ✅
- ICP: SP 507453c8 (appId 7822f093), tenant eaf1a864, Log Analytics Reader on law-dax-impact-capital — RBAC propagating (self-heals, no action needed)

**Azure Monitor (backup threshold alerts — dax@dakona.com + #alerts webhook)**
- Dakona: 4 rules (LibreChat-Errors, Auth-Failures, Revision-Failed, N8n-Errors) → ag-dax-alerts
- ICP: 3 rules (ICP-Errors, ICP-Auth-Failures, ICP-Revision-Failed) → ag-dax-icp-alerts

**n8n — DAX Error Handler (jqqz9K51fdtrU8Zf)**
- Error Trigger catches failed n8n workflow executions → #alerts
- Wired on: DAX Alert Router, DAX Inbox (x2), PNT Generate Invoice PDF

**[Forge] 2026-04-18:** DONE — real-time monitor live, Dakona confirmed, ICP propagating.

---

## TASK-20260417-1ALTX-001 — FormDriver
- **Assignee:** Forge
- **Status:** DONE (Phase A + B)
- **Date:** 2026-04-18
- **Title:** FormDriver — 1AltX data-driven E2E form filler and stress tester

### Completed

**Repo:** scubarichard/1altx-formdriver (private) — commit a8cd245

**Phase A — Driver (DONE)**
- Puppeteer drives PNT booking form end-to-end: Page 2 (Booking Basics) → Page 1 (Travelers) → Page 3 (Hotels) → Page 7 (Pricing) → Page 8 (Review)
- Auth bypass, brand `__other__` + free text, hotel typeahead via `state.hotels`, live calc capture
- TC-001 drive: 30s, bookingRecordId captured, review page confirms booking name

**Phase B — Verifier (DONE)**
- Reads Airtable record back via API proxy after submission
- Diffs every `expected_airtable` field: value, type, number parsing
- TC-001 verify: 4/4 PASS — Pax=2 ✓, Billing Entity=PNT ✓, Base Price=1350 ✓, Fat PNT Number ✓

**Config/Fixture structure (DONE)**
- `configs/pnt.config.json` — points to PNT form + API, testPrefix, fixturesFile
- `fixtures/pnt_test_scenarios.json` — TC-001 fully wired, TC-002 through TC-010 stubs (Phase C)
- `run.js` — single scenario CLI, `run_all.js` — batch runner with HTML report (Phase D shell ready)
- `src/cleanup.js` — deletes TEST_ records via Airtable API (Phase E)

**TEST_ records:** cleaned up after each test run — 0 left in Airtable

### Pending (morning discussion)
- **Phase C** — write all 10 fixtures with real PNT tour/hotel names
- **Phase D** — batch runner (shell ready, needs Phase C fixtures)
- **Phase E** — cleanup integrated into run flow
- **Phase F** — admin.html button + n8n webhook
- Open questions: keep/delete test records, sequential vs parallel, repo location confirmed as `1altx-formdriver`

**[Forge] 2026-04-18:** DONE (Phase A+B) — TC-001 4/4 PASS, repo live at scubarichard/1altx-formdriver. Standing by for Phase C go-ahead.

---

## TASK-20260421-FORGE-1ALTX-001 — PVC Pipeline Follow-up
- **Assignee:** Forge
- **Status:** PENDING
- **Date:** 2026-04-21
- **From:** Sonnet (session handover)
- **Client:** 1AltX
- **Priority:** Medium
- **Title:** Absorb PVC pipeline, fix col V collision, optional Descript uploader

### Context

Sonnet built the full PVC (Proposal Video Creator) pipeline on 2026-04-21 and wants Forge to own it going forward. Full handover at `RESULTS/task_1altx_010_results.md` — covers architecture, FFmpeg spec, file inventory, known issues.

### Pipeline location

`C:\Users\18473\Tools\autovid-outreach\` — 6 working files + service_account.json + README.md

Key files:
- `record_videos.py` (Forge-built, screen recorder via Chrome CDP)
- `overlay_batch.ps1` (Sonnet-built, talking-head chromakey overlay)
- `populate_aj.ps1` (Sonnet-built, writes local paths to sheet col AJ)
- `run_pipeline.ps1` (Sonnet-built, orchestrator)
- `config.json` (centralized config)

### Tasks

**Phase 1 — Absorb (read only)**
- Read `RESULTS/task_1altx_010_results.md` fully
- Inspect scripts in `C:\Users\18473\Tools\autovid-outreach\`
- Confirm ownership — no code changes yet

**Phase 2 — Fix col V collision (required)**
- `record_videos.py` writes local filenames to col V
- But col V was designed for Descript share URLs (per TASK-1ALTX-008)
- Rows 2-33 have Descript URLs in V, rows 34-41 have local filenames
- Decide canonical schema (recommendation in handover doc) and fix:
  - Option A: Change `VIDEO_COL` in record_videos.py to new column, leave V for Descript URLs
  - Option B: Stop writing to sheet from recorder entirely — use filesystem as source of truth (populate_aj.ps1 already does this via col B regex)
  - Option C: Accept V for local filenames, move existing Descript URLs to col AK
- Clean up rows 34-41 (remove local filenames from V)

**Phase 3 — Optional: Descript API uploader**
- Descript API token validated and stored at `C:\Users\18473\Tools\autovid-outreach\descript_token.txt` (also in Azure KV `kvdaxdakonapilot/descript-api-token`)
- Token format: `dx_bearer_{uuid}:dx_secret_{uuid}`
- Endpoint: `POST https://descriptapi.com/v1/jobs/import/project_media`
- Use direct upload (signed URL) method — no public hosting needed
- Project should be named: `1AltX - {Job Title from col A}`
- Output: write project URL to new col (e.g., col AL "Descript Project URL")
- User then opens URL, clicks Publish, copies share link, pastes into col AK (col V per current convention)
- See handover doc for full API details

**Phase 4 — Optional: rename to PVC convention**
- Richard suggested "PVC" (Proposal Video Creator) as project name
- Rename scripts: `pvc_record.py`, `pvc_overlay.ps1`, `pvc_populate.ps1`, `pvc_run.ps1`
- Rename folder: `autovid-outreach` → `pvc`
- Update all cross-references + README

### Gate

- Phase 2 must ship before Phase 3 or 4
- Phase 1 is free — just reading
- Gate Phase 2 result: show me sheet after cleanup (col V consistent — all Descript URLs or all empty, no mixed content)

### Notes

- 97 videos rendered end-to-end during Sonnet session — all at `C:\Users\18473\Dropbox\Companies\1AltX\Tools\Video\out\`
- 69 of 97 matched sheet rows (28 orphans — source rows deleted from sheet)
- Pipeline is resume-safe, works today for Richard's 22 pending rerecords (61, 65, 79, 87, 107-124)
- Do not break current pipeline during refactor — Richard will run it again soon

---

## TASK-20260422-FORGE-DAX-001 — DAX ICP Critical Fixes
- **Assignee:** Forge
- **Status:** PENDING
- **Date:** 2026-04-22
- **From:** Opus
- **Client:** Impact Capital Partners (ICP)
- **Priority:** CRITICAL — Brett's team is live on dax.impact-cp.com TODAY
- **Title:** DAX ICP deployment fixes — Brett's team is logging in

### Context

Brett Stone and his 9-person team at Impact Capital Partners have been given access to dax.impact-cp.com. Emails sent. They are logging in now. Multiple features are broken or unverified. Every hour this sits unfixed is a risk to the client relationship.

### Task 1 — Check ICP login activity (5 min)
Check who has logged in:
- Cosmos DB `cosmos-dax-impact-capital` → database `librechat` → collection `users` — list all records
- OR Entra sign-in logs for app `7822f093-9c83-4b1a-83db-29517d29ac89` in tenant `eaf1a864-97ff-451c-87e7-88cf7512e98c`
- Post: user emails, sign-in times, success/failure

### Task 2 — Verify sub-workflows are active (5 min)
SSH into `vm-n8n-icp` (10.0.6.4):
```
sqlite3 /home/dkn8n/.n8n/database.sqlite "SELECT id, name, active FROM workflow_entity;"
```
ALL sub-workflows must be active=1. If any are active=0, activate them:
- Document Generator (`f1QOMhmTRbsVCfvv`)
- Market Data (`InrgO4rhHjdtmmT9`)
- Compliance Flagging (`paJIzAuA7LDHfz3G`)
- Research and Write (`cdGyU8SydyOUAtIX`)
- Market Summary (`a9vLDGKRxe83oW19`)

### Task 3 — Verify document generation (10 min)
Richard tested "Write a 500-word article on rising interest rates" — DAX said "It will appear in your DAX Documents folder in about 2 minutes." Verify:
1. Check n8n execution logs — did the Document Generator or Research and Write workflow actually execute?
2. Check ICP SharePoint via Graph API — are there ANY files in DAX Documents?
```
GET https://graph.microsoft.com/v1.0/sites/impactcapitalpartnersllc.sharepoint.com,9408138e-0aa3-404e-b131-bc905b2d99d0,40e05979-6387-4bb6-8b8e-6638aa9c1e2f/drive/root:/DAX Documents:/children
```
3. If folder is empty → doc gen is failing silently. Check execution logs for the error.

### Task 4 — Fix document generation crash (30 min)
"Write me an executive summary — 1 page of this" crashes with:
```
Cannot read properties of undefined (reading 'role')
```
This is in the Document Generator or Research and Write sub-workflow. The messages array has an undefined entry.
- Check n8n execution log for the failed execution
- Find the node that crashed
- Add null check before accessing `.role` on message objects
- Test: ask DAX to "write a 500 word article about Tesla and save it" — confirm it saves to SharePoint and returns a URL

### Task 5 — Replace compliance.html (10 min)
`dax.impact-cp.com/compliance` currently shows:
- "Dakona LLC" branding (wrong — should be Impact Capital Partners or hidden)
- No authentication — API key in URL
- No data
- Brett's team could see this TODAY

Replace with a simple "Coming Soon" page:
```html
<html><body style="background:#1a1a2e;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center"><h1>DAX Compliance Portal</h1><p>Coming Soon</p></div>
</body></html>
```

### Task 6 — Add capabilities guide to system prompt (15 min)
Add the capabilities guide to BOTH routers (Dakona `3tniyxZREqfnAbfo` and ICP `wGhmfrxHEBK7FzES`). Full spec posted in #dax-collab on 2026-04-14 at 1776186401.717839. Key requirement: when a feature requires Wealthbox/Outlook/SharePoint that isn't connected, DAX should say "that feature requires [system] to be connected — contact your administrator" instead of failing silently.

### Task 7 — Enable streaming (5 min)
LibreChat config: change `stream: false` to `stream: true`. Update `CONFIG_YAML_B64` on `ca-dax-impact-capital` and restart. Single biggest perceived performance improvement.

### Task 8 — Replicate all Dakona fixes to ICP (30 min)
Ensure these Dakona fixes are deployed to ICP:
- Lowercase ticker fix (`.toUpperCase()`)
- Ticker false positive stop list + intent gate
- File upload / document reading via SharePoint (if built on Dakona)

### Execution order
1 → 2 → 5 → 6 → 7 → 3 → 4 → 8

### Gate
Post results for ALL 8 tasks here. Do not mark DONE until:
- Sub-workflows all active
- Document generation produces a file in SharePoint with a URL returned to the user
- Compliance.html replaced
- Streaming enabled
- System prompt updated on both routers

### ICP Infrastructure Reference
- Subscription: `e1c109d7-9232-4e26-bed7-b1e1b5a6f611`
- Tenant: `eaf1a864-97ff-451c-87e7-88cf7512e98c`
- Container App: `ca-dax-impact-capital` in `rg-dax-impact-capital`
- n8n VM: `vm-n8n-icp` (10.0.6.4)
- Cosmos DB: `cosmos-dax-impact-capital`
- Key Vault: `kvdaximpactcapital`
- SharePoint Site ID: `impactcapitalpartnersllc.sharepoint.com,9408138e-0aa3-404e-b131-bc905b2d99d0,40e05979-6387-4bb6-8b8e-6638aa9c1e2f`
- Router workflow: `wGhmfrxHEBK7FzES`
- DAX-ICP SSO app: `7822f093-9c83-4b1a-83db-29517d29ac89`
- DAX Document Generator app: `1678bb95-083d-45b5-a3ea-31941773d2d4`


---

## TASK-20260422-TRITON-1ALTX-001 — Catalog Video Library (Phase F)
- **Assignee:** Triton
- **Status:** PENDING
- **Date:** 2026-04-22
- **From:** Sonnet (session with Richard)
- **Client:** 1AltX (internal — building sales asset library)
- **Priority:** Medium
- **Title:** Build catalog video scenario library + YouTube upload pipeline

### Context

Richard has 13 existing Descript-hosted catalog videos (the 1AltX product catalog — Close-ClickUp, Shopify Top 30, etc.). He wants to build a YouTube-hosted library using the autovid pipeline with three additions per video:

1. **Opening:** bespoke hook per automation (pain point → reveal → promise)
2. **CTA card:** standardized outro (script locked — see "Locked Assets" below)
3. **YouTube upload:** automatic publish to his YouTube channel (@1AltXLLC, channel ID `UCq_19UyLx50ng6EXFvPnQUw`)

Why Triton and not Forge: this is primarily **scenario schema work + narration writing + YouTube API integration** — architecture and config work, not capture/compose plumbing. Forge already owns capture/compose. Triton owns config schema per the ORCHESTRATION.md protocol.

### First step — catch up on the repo (DO THIS BEFORE ANY CODE)

Triton does not have Forge's full context on the autovid codebase. Before writing anything:

1. Read `docs/ORCHESTRATION.md` — gate protocol, role definitions, one-phase-one-PR rule
2. Read `docs/PHASE_E.md` — scene schema, module reference, pipeline data flow
3. Read `docs/PHASE_D_PVC.md` — Sonnet's session handover (separate PVC track — helpful context on 1AltX sheets + ElevenLabs usage)
4. Read `scenarios/chosen-walkthrough.json` + `scenarios/opt-walkthrough.json` — production-quality examples of the scenario schema
5. Read `config/scenario.schema.json` — canonical schema (extend this for catalog-type scenarios)
6. Read `config/voice.json` — voice profile config pattern
7. Read `src/pipeline/run.js` — orchestrator, understand how scenarios are consumed
8. Read `src/compose/scene.js` + `src/compose/concat.js` — how scenes merge

Only after reading all the above, begin implementation. If anything is unclear, post a question in `#dax-collab` prefixed `[Triton]` before building.

### Scope — 4 phases

**Phase F.1 — Catalog scenario schema**

Extend `config/scenario.schema.json` with a new scenario type: `catalog_item`. Canonical structure:

```
scenarios/catalog/
  ├── _template.json        ← reusable template
  ├── 01-close-clickup.json
  ├── 02-close-agencyhandy.json
  ├── 03-smart-email-intake.json
  ├── 04-sheets-pdf-docuseal.json
  ├── 05-ai-blog-generator.json
  ├── 06-ringover-webhook.json
  ├── 07-csv-apps-script.json
  ├── 08-shopify-top30.json
  ├── 09-shopify-matrixify.json
  ├── 10-msp-psa-export.json
  ├── 11-pipedrive-zendesk.json
  ├── 12-receipts.json
  └── 13-google-form-pdf.json
```

Each catalog scenario has **exactly 3 scenes**:
- `scene-01-opener` (type: `title_card`, ~12 sec) — hook + reveal + promise
- `scene-02-demo` (type: `user_provided`, 60-90 sec) — the existing demo footage
- `scene-03-cta` (type: `title_card`, ~15 sec) — standardized CTA (see Locked Assets)

Scene 2 source_path: Richard will provide existing MP4 exports from Descript (or we re-record — see Phase F.2 Open Questions below). Triton's job is the scenario structure, not the demo content itself.

**Phase F.2 — Write all 13 opener scripts**

Richard chose **bespoke** opener scripts (not templated). Standard length (~14 seconds each).

Structure for each:
1. **Hook** — bespoke 1-sentence pain point specific to this automation
2. **Reveal** — "This is how our {automation_name} {outcome}"
3. **Promise** — "In the next {duration}, I'll show you exactly how it works"

The 13 automations and draft hooks (Sonnet-drafted — Triton should refine where prospect context is missing):

| # | Automation | Draft hook (refine as needed) |
|---|---|---|
| 1 | Close → ClickUp | "Every closed deal in Close creates ten minutes of admin in ClickUp. This automation does it in ten seconds." |
| 2 | Close → AgencyHandy | "Your agency sells in Close but delivers in AgencyHandy — somewhere in between, details get lost. This closes the gap." |
| 3 | Smart Email Intake Logger | "Your inbox is full of leads you never logged. This automation captures every one, tagged and ready to work." |
| 4 | Sheets → PDF/DocuSeal | "If you''re still pasting spreadsheet rows into contract templates, you''re wasting an hour every time." |
| 5 | AI Blog Post Generator | "Writing one blog post takes four hours. Writing ten takes this automation thirty minutes." |
| 6 | Ringover Webhook Listener | "Every missed call in Ringover should create a task somewhere. This automation makes sure none slip through." |
| 7 | CSV → Apps Script | "Drop a CSV in a folder. Watch it become a fully processed dataset in your sheet — without touching a thing." |
| 8 | Shopify Top 30 | "Monday mornings, 9am — is your bestsellers report ready, or are you still building it?" |
| 9 | Shopify Matrixify | "Managing thousands of Shopify product variants shouldn''t require a developer. This automation gives your team that power." |
| 10 | MSP PSA Export | "Your PSA has the data your clients need. This automation puts it in their hands — on schedule, no manual pulls." |
| 11 | Pipedrive → Zendesk | "When a deal closes in Pipedrive, support picks up in Zendesk — without anyone copying anything between them." |
| 12 | Receipt Submission | "Your team shouldn''t email receipts to accounting. This automation lets them submit, tag, and forget." |
| 13 | Google Form → PDF | "Every form submission becomes a branded PDF — in your drive, in your client''s inbox, automatically." |

**Open questions for Phase F.2 — post in #dax-collab for Richard to answer before writing the 6 below:**
- **#2 (AgencyHandy):** what handoff does this automate — project setup, billing, or both?
- **#3 (Smart Email Intake):** leads, support tickets, all inbound, or something else?
- **#6 (Ringover):** logs calls, routes them, creates tasks, syncs to CRM?
- **#7 (CSV → Apps Script):** data import, transformation, or reporting use case?
- **#9 (Matrixify):** bulk import/export, variant management, or migration?
- **#10 (MSP PSA):** exports to what — client reports, billing, analytics?

**Phase F.3 — YouTube uploader module**

Build `src/publish/youtube.js` as a new autovid module. Not a standalone script — integrates into the pipeline so scenarios can opt in via a `publish: { youtube: true }` field in the scenario JSON.

**Requirements:**
- Uses YouTube Data API v3, scope `https://www.googleapis.com/auth/youtube.upload`
- Reads credentials from OAuth flow (not service account — YouTube requires user auth)
- Uploads as **Unlisted** by default (Richard reviews, publishes manually)
- Metadata fields from scenario JSON:
  - `title` — "{automation_name} — 1AltX Product Catalog"
  - `description` — auto-generated from scenario `_notes.description` + CTA text + link to `https://1altx.com`
  - `tags` — `["1AltX", "automation", "{category}", ...scenario.tags]`
  - `category_id` — 28 (Science & Technology) or 22 (People & Blogs) — Triton pick
- Returns: `{ videoId, url, title, privacyStatus }`
- Writes result back to scenario JSON as `_notes.youtube_url` for traceability
- Quota budget: each upload costs 1600 units; daily limit is 10,000 units = **6 uploads/day max**. Build in a rate-limiter or at minimum document this clearly in README

**Critical lessons from Sonnet''s 2026-04-21 YouTube tangent (don''t repeat):**
- OAuth `redirect_uri` must EXACTLY match what''s in the GCP Desktop OAuth client config — port 80 vs 8080 caused failures
- Token refresh: store refresh_token, don''t re-auth every run
- Brand channel vs personal channel auth context matters — uploads may go to the wrong channel if the user switches accounts during OAuth. Verify `channels.list?mine=true` after auth.
- Test uploads orphaned from wrong channel can''t be deleted via API from a different auth context. Use `videos.list?id={ids}` to verify ownership before trusting the delete endpoint.

**Phase F.4 — Integration test**

Run the full pipeline end-to-end on **1 catalog item only** (Triton picks the easiest — recommend Close → ClickUp since it has the clearest demo footage pattern). Deliverable:
- Opener card rendered with bespoke narration in Richard''s voice (ElevenLabs)
- Demo scene embedded
- CTA card rendered with locked CTA script (same ElevenLabs voice)
- All 3 scenes concatenated into final MP4
- Uploaded to YouTube as Unlisted
- YouTube URL posted in gate results

Once Phase F.4 passes review, Triton (or Forge) can batch-render and batch-upload the remaining 12.

### Locked assets (do not modify without Richard''s approval)

**CTA script (exact wording — used in scene-03-cta for all 13 videos):**

> "You''ll be amazed how much manual work disappears when the right automation kicks in. Visit one alt X dot com and schedule a call — we''ll scope it, size it, and give you a straight price."

**CTA card visual spec (design):**
- Background: dark (match Richard''s DAX demo v2 title cards — coordinate with Forge for exact colors)
- Logo: "1AltX" wordmark top-center
- Main text: "onealtx.com"
- Subtitle: "Schedule a call"
- Duration: 15 seconds (matches audio)

**Opener card visual spec (design):**
- Eyebrow: "1ALTX PRODUCT CATALOG" (all caps)
- Title: {automation_name} — e.g., "Close → ClickUp"
- Subtitle: short pain statement, 4-6 words max
- Duration: 12 seconds (matches audio)

### Credentials + infrastructure reference

**Azure Key Vault (autovid uses `kvdaximpactcapital`, NOT kvdaxdakonapilot):**
- `ELEVENLABS-API-KEY` — ElevenLabs API key
- `ELEVENLABS-VOICE-ID-RICHARD` — Richard''s voice clone ID (= `IuxDTLynYdvisya7jrK5`, verified in chosen scenario)
- `ANTHROPIC-API-KEY` — Claude API key for narration generation (Phase E already wired)

**Dakona KV (`kvdaxdakonapilot`) — NOT used by autovid, but reference:**
- `descript-api-token` — Descript API bearer (used by PVC track, not catalog track)
- `github-token` — GitHub PAT for scubarichard

**YouTube OAuth (does NOT exist yet — Triton creates in Phase F.3):**
- Create Desktop OAuth 2.0 Client in GCP project `positive-bonbon-478413-p1` (same project Sonnet used 2026-04-21)
- Or: new GCP project dedicated to 1AltX — Triton''s call
- Scope: `https://www.googleapis.com/auth/youtube.upload`
- Store `client_secret.json` + `token.json` at `C:\Users\18473\Tools\autovid-youtube\` (NOT in repo)
- Add to `.gitignore`: `youtube_*.json`, `token.json`
- Refresh token stored securely; rotation not required but note expiry behavior in README

**Paths:**
- Repo clone: `C:\Users\18473\Dropbox\Companies\1AltX\Projects\_clients\1altx-autovid\`
- Scenarios output: `scenarios/catalog/`
- Artifacts (intermediate MP4s): `artifacts/catalog/{id}/`
- Final output: `C:/Users/18473/Dropbox/Companies/1AltX/Catalog/Videos/{id}.mp4` (Triton create this folder)
- Existing catalog demo footage source: Richard will drop in `C:/Users/18473/Dropbox/Companies/1AltX/Tools/Video/catalog/` (coordinate with Richard on getting the 13 demo clips — may require re-exporting from Descript)

**Sheet (if any tracking needed):**
- No sheet yet — Triton decide if one is needed or if scenario JSONs are sufficient. Voting lean: scenario JSONs are sufficient, add a sheet only if Richard wants it for catalog management.

### Gate protocol (per ORCHESTRATION.md)

1. Branch: `triton/catalog-video-library`
2. Phase F.1 (schema) → Sonnet pre-review → commit
3. Phase F.2 (13 opener scripts) → Richard reviews the bespoke hooks (especially the 6 marked as open questions) → commit
4. Phase F.3 (YouTube uploader) → Sonnet pre-review → commit
5. Phase F.4 (integration test, 1 video) → Richard reviews the actual Unlisted YouTube video → IF PASS → merge PR to main
6. Batch render remaining 12 → all upload to YouTube Unlisted → Richard publishes from YouTube Studio UI

### Deliverables for this task (PENDING → DONE)

- [ ] Branch created, all docs read (comment in gate result: "I read X, X, X")
- [ ] Phase F.1: schema extended + `_template.json` committed
- [ ] Phase F.2: all 13 opener scripts committed (OPEN QUESTIONS resolved with Richard first)
- [ ] Phase F.3: `src/publish/youtube.js` + `docs/PHASE_F_YOUTUBE.md` committed
- [ ] Phase F.4: 1 catalog video rendered + uploaded to YouTube Unlisted
- [ ] Gate result posted: YouTube URL + any surprises encountered

### Do NOT

- Do not publish anything to YouTube as Public. All uploads Unlisted. Richard publishes from YouTube Studio UI.
- Do not re-record existing catalog demo footage without explicit Richard ask — reuse existing Descript-sourced MP4s if Richard provides them
- Do not modify the locked CTA script
- Do not touch Forge''s catalog-commission-tracking-v2 branch or the main autovid pipeline — catalog scenarios are additive, not a refactor
- Do not put credentials in the repo
- Do not skip the "read the repo docs first" step — your context is not Forge''s context
