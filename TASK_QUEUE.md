# TASK QUEUE — Mission Control
# Agents poll for PENDING tasks assigned to them. Execute → mark DONE → write results to RESULTS/.

---

## TASK-20260422-FORGE-DAX-001 — DAX ICP Critical Fixes
- **Assignee:** Forge
- **Status:** PENDING
- **Date:** 2026-04-22
- **From:** Opus
- **Client:** Impact Capital Partners (ICP)
- **Priority:** CRITICAL — Brett's team is live on dax.impact-cp.com TODAY
- **Title:** DAX ICP deployment fixes — Brett's team is logging in
- **[Forge] 2026-05-19 BLOCKER:** ICP deployment lock is active — unlock code required before any dax.impact-cp.com work. Awaiting Richard's go-ahead.

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
| 4 | Sheets → PDF/DocuSeal | "If you're still pasting spreadsheet rows into contract templates, you're wasting an hour every time." |
| 5 | AI Blog Post Generator | "Writing one blog post takes four hours. Writing ten takes this automation thirty minutes." |
| 6 | Ringover Webhook Listener | "Every missed call in Ringover should create a task somewhere. This automation makes sure none slip through." |
| 7 | CSV → Apps Script | "Drop a CSV in a folder. Watch it become a fully processed dataset in your sheet — without touching a thing." |
| 8 | Shopify Top 30 | "Monday mornings, 9am — is your bestsellers report ready, or are you still building it?" |
| 9 | Shopify Matrixify | "Managing thousands of Shopify product variants shouldn't require a developer. This automation gives your team that power." |
| 10 | MSP PSA Export | "Your PSA has the data your clients need. This automation puts it in their hands — on schedule, no manual pulls." |
| 11 | Pipedrive → Zendesk | "When a deal closes in Pipedrive, support picks up in Zendesk — without anyone copying anything between them." |
| 12 | Receipt Submission | "Your team shouldn't email receipts to accounting. This automation lets them submit, tag, and forget." |
| 13 | Google Form → PDF | "Every form submission becomes a branded PDF — in your drive, in your client's inbox, automatically." |

**UPDATE 2026-04-22: No open questions remain — Sonnet transcribed all 13 videos.**

Research artifacts at `RESULTS/catalog-research/`:
- `README.md` — full summary of all 13 automations with draft opener hooks
- `transcripts/*.txt` — Whisper-generated transcripts of Richard's actual narration
- `summaries/*.json` — structured Claude analysis per video (automation_name, what_it_does, pain_it_solves, outcome, key_systems, duration_implied, opener_hook_draft, bespoke_opener_full)

Triton: **start with `RESULTS/catalog-research/README.md`**. The draft opener hooks in that doc replace the ones in the table above — they're based on Richard's actual narration, not Sonnet's guesses. Refine wording, don't start from scratch. If a hook doesn't feel right, check the transcript.

Key findings from the research (surprises vs. the original task):
- #3 "Smart Email Intake Logger" is actually a **UpWork job filter + Google Sheets logger** using Gmail + GPT-4 (not a general inbox logger)
- #7 "CSV → Apps Script" is specifically a **Ringify call log tagger** (a sibling to #6 Ringover, not a generic CSV processor)
- #9 "Shopify Matrixify" is correctly named **Metricify** in the video — Triton may want to align the catalog name with what Richard actually calls it
- #12 "Receipt Submission" is specifically for **GOOT Vitality** vendor/client folder filing (narrower scope than the generic name suggests)

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

**Critical lessons from Sonnet's 2026-04-21 YouTube tangent (don't repeat):**
- OAuth `redirect_uri` must EXACTLY match what's in the GCP Desktop OAuth client config — port 80 vs 8080 caused failures
- Token refresh: store refresh_token, don't re-auth every run
- Brand channel vs personal channel auth context matters — uploads may go to the wrong channel if the user switches accounts during OAuth. Verify `channels.list?mine=true` after auth.
- Test uploads orphaned from wrong channel can't be deleted via API from a different auth context. Use `videos.list?id={ids}` to verify ownership before trusting the delete endpoint.

**Phase F.4 — Integration test**

Run the full pipeline end-to-end on **1 catalog item only** (Triton picks the easiest — recommend Close → ClickUp since it has the clearest demo footage pattern). Deliverable:
- Opener card rendered with bespoke narration in Richard's voice (ElevenLabs)
- Demo scene embedded
- CTA card rendered with locked CTA script (same ElevenLabs voice)
- All 3 scenes concatenated into final MP4
- Uploaded to YouTube as Unlisted
- YouTube URL posted in gate results

Once Phase F.4 passes review, Triton (or Forge) can batch-render and batch-upload the remaining 12.

### Locked assets (do not modify without Richard's approval)

**CTA script (exact wording — used in scene-03-cta for all 13 videos):**

> "You'll be amazed how much manual work disappears when the right automation kicks in. Visit one alt X dot com and schedule a call — we'll scope it, size it, and give you a straight price."

**CTA card visual spec (design):**
- Background: dark (match Richard's DAX demo v2 title cards — coordinate with Forge for exact colors)
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
- `ELEVENLABS-VOICE-ID-RICHARD` — Richard's voice clone ID (= `IuxDTLynYdvisya7jrK5`, verified in chosen scenario)
- `ANTHROPIC-API-KEY` — Claude API key for narration generation (Phase E already wired)

**YouTube OAuth (does NOT exist yet — Triton creates in Phase F.3):**
- Create Desktop OAuth 2.0 Client in GCP project `positive-bonbon-478413-p1` (same project Sonnet used 2026-04-21)
- Scope: `https://www.googleapis.com/auth/youtube.upload`
- Store `client_secret.json` + `token.json` at `C:\Users\18473\Tools\autovid-youtube\` (NOT in repo)
- Add to `.gitignore`: `youtube_*.json`, `token.json`

**Paths:**
- Repo clone: `C:\Users\18473\Dropbox\Companies\1AltX\Projects\_clients\1altx-autovid\`
- Scenarios output: `scenarios/catalog/`
- Artifacts (intermediate MP4s): `artifacts/catalog/{id}/`
- Final output: `C:/Users/18473/Dropbox/Companies/1AltX/Catalog/Videos/{id}.mp4`
- Existing catalog demo footage source: `C:/Users/18473/Dropbox/Companies/1AltX/Tools/Video/catalog/`

### Gate protocol (per ORCHESTRATION.md)

1. Branch: `triton/catalog-video-library`
2. Phase F.1 (schema) → Sonnet pre-review → commit
3. Phase F.2 (13 opener scripts) → Richard reviews → commit
4. Phase F.3 (YouTube uploader) → Sonnet pre-review → commit
5. Phase F.4 (integration test, 1 video) → Richard reviews Unlisted YouTube video → IF PASS → merge PR to main
6. Batch render remaining 12 → all upload Unlisted → Richard publishes from YouTube Studio

### Deliverables

- [ ] Branch created, all docs read
- [ ] Phase F.1: schema extended + `_template.json` committed
- [ ] Phase F.2: all 13 opener scripts committed
- [ ] Phase F.3: `src/publish/youtube.js` + `docs/PHASE_F_YOUTUBE.md` committed
- [ ] Phase F.4: 1 catalog video rendered + uploaded to YouTube Unlisted
- [ ] Gate result posted: YouTube URL

### Do NOT

- Do not publish anything to YouTube as Public — all uploads Unlisted
- Do not re-record existing catalog demo footage without explicit Richard ask
- Do not modify the locked CTA script
- Do not put credentials in the repo

---

## TASK-20260424-NAUTILUS-1ALTX-001 — PVC Pipeline Context Sync
- **Assignee:** Nautilus
- **Status:** PENDING
- **Date:** 2026-04-24
- **From:** Sonnet (session with Richard)
- **Client:** 1AltX (internal)
- **Priority:** Low
- **Title:** Clone autovid-outreach repo and load PVC pipeline context

### Context

Richard built a local Windows pipeline called PVC (Proposal Video Creator) that generates personalized Upwork proposal videos. The pipeline runs on his Windows machine (cannot run on Linux). Nautilus does not need to run the pipeline — its role is to stay aware of pipeline state so it can assist with editing scripts, updating MEMORY.md, querying the Google Sheet, and other support tasks.

### Tasks

**Step 1 — Clone the repo (one-time setup)**

```bash
cd ~
git clone https://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@github.com/scubarichard/autovid-outreach.git
cd autovid-outreach
```

**Step 2 — Read the state file**

```bash
cat ~/autovid-outreach/MEMORY.md
```

**Step 3 — Read the README**

```bash
cat ~/autovid-outreach/README.md
```

**Step 4 — Confirm context loaded**

Post a gate result below confirming: repo cloned, MEMORY.md state summary, last processed rows, known open items, what Nautilus is ready to help with.

### Standing instructions (add to your startup routine)

```bash
git -C ~/autovid-outreach pull 2>/dev/null && cat ~/autovid-outreach/MEMORY.md
```

### Gate

- [ ] Repo cloned
- [ ] MEMORY.md read and summarized
- [ ] Ready for PVC support tasks

---

## TASK-20260429-FORGE-PERSONAL-001 — Freqtrade Install on vm-dax-dev
- **Assignee:** Triton (reassigned from Forge)
- **Status:** BLOCKED (Forge) — reassigned to Triton
- **Date:** 2026-04-29
- **Client:** Personal (Richard Mabbun)
- **Priority:** Low
- **Title:** Install and configure Freqtrade crypto trading bot on vm-dax-dev

### Blocking note (Forge — 2026-04-30)
[Forge] Cannot execute from RICHARD-WS — SSH to 52.150.28.158:22 times out. NSG allows port 22, VM running. Likely local network block. **Triton should pick this up** — reassign to Triton (192.168.1.159).

### Tasks

SSH into vm-dax-dev via the jumpbox. Install isolated from DAX stack:

```bash
sudo apt update && sudo apt install -y python3 python3-pip python3-venv git curl
cd ~
git clone https://github.com/freqtrade/freqtrade.git freqtrade-personal
cd freqtrade-personal
./setup.sh -i
source .venv/bin/activate
freqtrade --version
freqtrade new-config --config config.json
# Set: exchange=binance, spot, USDT, stake_amount=10, max_open_trades=3, dry_run=true
freqtrade create-userdir --userdir user_data
cd user_data/strategies
git clone https://github.com/freqtrade/freqtrade-strategies.git community
```

Run backtest (SMAOffset recommended), then start dry-run in screen session.

### Constraints
- **Personal project only** — no DAX/KV/n8n integration
- **Dry-run only** — `"dry_run": true`, no real exchange API keys
- **Isolated** — all files under `~/freqtrade-personal/`

### Gate
- [ ] `freqtrade --version` confirmed
- [ ] Config generated with dry_run: true
- [ ] Strategy selected — name it
- [ ] Backtest results summary (win rate, profit %, max drawdown, Sharpe)
- [ ] Dry-run started in screen session

---

## TASK-20260430-CHOSEN-005 — Render Checker: 1 Richard UI Action Remaining
- **Assignee:** Richard
- **Status:** PARTIAL — 1 Make UI action remaining
- **Completed (partial):** 2026-05-01 by Forge
- **Client:** Erika Cobb / Chosen Agency

### Outstanding action (Richard only — requires Make UI)

Forge fixed M16+M17 via API. One step remains that requires UI (new scenario creation cannot be done via API):

**Richard must import Render Checker blueprint via Make UI:**
- Org: 885318, Folder: 232853
- Blueprint: `clients/chosen-agency/render-checker-blueprint.json` in repo
- Name: `Chosen Agency — Render Checker`
- Schedule: every 5 min, **keep INACTIVE** until acceptance tests pass

Post scenario ID here when done — Forge will complete wiring via API.

---

## TASK-20260519-RICHARD-HW-001 — RAM Upgrade: RICHARD-WS
- **Assignee:** Richard
- **Status:** PENDING (waiting for sale price)
- **Date:** 2026-05-19
- **Priority:** Low
- **Title:** Purchase 32GB RAM kit for XPS 15 9510

**Part:** Crucial CT2K16G4SFRA32A — 2×16GB DDR4-3200 SO-DIMM
**Current price:** ~$250 — wait for Prime Day / Black Friday (~$60–80 target)
**Alt:** eBay used matched pair
**ClickUp:** https://app.clickup.com/t/86e1f12nr
