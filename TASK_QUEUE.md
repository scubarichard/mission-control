# TASK QUEUE — Mission Control
# Agents poll for PENDING tasks assigned to them. Execute → mark DONE → write results to RESULTS/.

---

## TASK-20260521-NAUTILUS-ICP-PARAM-001 — ICP Parameterization Cleanup + Brett Demo Prep

- **Assignee:** Nautilus
- **Status:** PENDING_ACCESS
- **Priority:** 🔴 HIGH (blocks Brett Stone demo Wed-Fri May 27-29)
- **Deadline:** Tuesday May 26 EOD (verification PASS required)
- **Queued by:** Nautilus (per Richard 2026-05-21, Slack #dax-collab thread `p1779418461810869`)
- **ClickUp:** 86e12zmkh (parameterization) + 86e1gtz6x (meeting prep)
- **Original assignee in Slack:** Triton (Sonnet) — Nautilus picking up at Richard's request

### Blocked on access (waiting for Richard)

Nautilus cannot proceed until the following are unlocked on this workstation:
1. **ICP Azure tenant login** — `az login --tenant eaf1a864-97ff-451c-87e7-88cf7512e98c` (current `az` is on DAKONA 001 / tenant `d2a3c346` → `kvdaximpactcapital` returns `AKV10032 Invalid issuer`)
2. **Cloudflare Access OTP path to vm-n8n-icp / n8n.dakona.net SSH** — no `cloudflared` installed on Nautilus; Richard to initiate OTP session or install + configure
3. **SSH identity for `daxadmin@vm-n8n-icp`** and `dkn8n@n8n.dakona.net` — confirm Nautilus pubkey (`~/.ssh/id_ed25519.pub`) is authorized, or hand off a working session

Once unlocked, Nautilus executes the 5 tasks below.

### Scope (from Slack thread)

**TASK 1 — ICP SQLite audit** (vm-n8n-icp, `/home/daxadmin/.n8n/.n8n/database.sqlite`)
- grep for: `218064ac-bee2-4246-9709-ae7518ae71cb`, `6LR8Q~ZCn5FTBlg894LtCGlXZ9GV3NAhS4BY9bla`, `d2a3c346-00f3-47dd-a53e-caa3fca74714`, `dakonallc.sharepoint.com`, `2565bf3734934e0facbe77c7c2accd40`
- if any found → replace with ICP values, report

**TASK 2 — Deploy parameterized workflows**
- Dakona staging: `az containerapp update` on `ca-dax-n8n-dakona-pilot` setting GRAPH_CLIENT_ID / GRAPH_CLIENT_SECRET / GRAPH_TENANT_ID / SHAREPOINT_SITE_ID / WEALTHBOX_TOKEN (Dakona values) — ⚠️ `--set-env-vars` replaces ALL, re-specify everything
- ICP: same on vm-n8n-icp with ICP values (tenant `eaf1a864-97ff-451c-87e7-88cf7512e98c`, site ID `impactcapitalpartnersllc.sharepoint.com,9408138e-0aa3-404e-b131-bc905b2d99d0,40e05979-6387-4bb6-8b8e-6638aa9c1e2f`, Wealthbox empty string)
- Import master-branch parameterized workflows (Triton's commit), restart n8n, verify

**TASK 3 — Copy template** `ICP-Quarterly-Review-TEMPLATE.docx` Dakona SharePoint → ICP SharePoint DAX Templates via Graph API with ICP creds. Verify at `https://impactcapitalpartnersllc.sharepoint.com/sites/ImpactCapitalPartners/DAX Templates/`

**TASK 4 — ICP system prompt** apply "immutable encrypted database" compliance language + layered prompt client file `docs/prompts/clients/DAX-CLIENT-ICP.md` (after Dakona verified)

**TASK 5 — End-to-end verification** on dax.impact-cp.com (must PASS before Tue May 26 EOD):
- Chat: "Good morning" → response; "Write me a Python script to calculate bond yield" → code in chat, NOT create_document
- Market data: "What is SPY trading at?" → live price
- SharePoint: "Search SharePoint for investment policy" → ICP results (14,000+ items)
- DocGen: "Write a 200 word article about market trends and save it" → saves to ICP SharePoint DAX Documents (NOT Dakona's), verify in impactcapitalpartnersllc.sharepoint.com
- Email: "Check my email" → ICP inbox (NOT Dakona's)
- Calendar: "What's on my calendar today?" → ICP calendar
- Compliance: "How is my data protected?" → "immutable encrypted database" language; "How is DAX different from ChatGPT?" → compliance comparison
- Negative: grep ICP SQLite for `dakonallc` → 0 matches; grep for `d2a3c346` → 0 matches

Post PASS/FAIL per item in this task block. Tag Richard immediately on any FAIL.

### Access reference (from Slack)
- n8n VM: `n8n.dakona.net` (dkn8n, Cloudflare OTP)
- Dev VM: `172.16.0.5` (daxadmin, SSH from n8n)
- ICP n8n: `vm-n8n-icp` (daxadmin)
- Dakona KV: `kvdaxdakonapilot`
- ICP KV: `kvdaximpactcapital`
- MCP: `mcp.dakona.net` (SSE)
- Context: `docs/PO-BRIEF.md`

---

## TASK-20260515-FORGE-RIA-SCRAPER-002 — RIA Email Scraper Run 2 (1,825 firms)

- **Assignee:** Forge
- **Status:** PENDING
- **Date:** 2026-04-22
- **From:** Opus
- **Client:** Impact Capital Partners (ICP)
- **Priority:** CRITICAL — Brett's team is live on dax.impact-cp.com TODAY
- **Title:** DAX ICP deployment fixes — Brett's team is logging in
- **[Forge] 2026-05-19 BLOCKER:** ICP deployment lock is active — unlock code required before any dax.impact-cp.com work. Awaiting Richard's go-ahead.
- **[Forge] 2026-05-21 BLOCKER:** Task header says "RIA Email Scraper Run 2 (1,825 firms)" but body contains old ICP DAX task content. Content mismatch — cannot execute either interpretation. If this is the ICP task: deployment lock still active (no PETA unlock received). If this is an RIA scraper task: no body/instructions provided. Richard to clarify.

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

## ERROR-RECOVERY PROTOCOL

If subtask fails:
1. Read error
2. Identify failing module/operation
3. Check tonight's known patterns:
   - String/int type errors → cast
   - parseJSON → use Parse JSON modules
   - Sheet name blank → set explicitly
   - Column case → V1 uses Title Case
   - Filter on route → move to module
   - Control chars in body → `replace(text; (newline); " ")`
4. Apply fix, re-test
5. Up to 3 retries
6. After 3 fails: post to Slack with subtask number + attempt + error. STOP.

---

## DONE WHEN

All 6 subtasks complete. CHOSEN-006 unblocked.

---

# TASK-20260430-CHOSEN-006 — V1 Phase 6: Documentation Suite

**Status:** DONE
**Owner:** Forge
**Started:** 2026-05-01 by Forge
**Completed:** 2026-05-01 by Forge
**Client:** Erika Cobb / Chosen Agency
**Priority:** High
**Created:** 2026-04-30 by Richard
**Estimated effort:** 3-4 hours
**Depends on:** CHOSEN-005 (Render Checker + tests passed)

---

## STRATEGIC CONTEXT

Phase 6 deliverables per SOW Section 14:
- Operator SOP
- Field map
- Credential map
- Troubleshooting guide

These go in Drive folder `10_Documentation` with Markdown copies in repo.

Loom recordings (3 separate per SOW) are NOT in this task — Richard records.

---

## CRITICAL RULES

1. SAVE AFTER EVERY DOC. Commit each as soon as drafted.
2. DON'T BLOCK ON PERFECT. 80% draft — Richard polishes.
3. REFERENCE ACTUAL ASSET STATE. Pull live blueprint from Make API for credential map. Pull live sheet schema from Sheets API for field map.
4. NO LOOM RECORDINGS.

---

## SUBTASKS

### Subtask 1 — Operator SOP

Output: `clients/chosen-agency/docs/operator_sop.md`
Audience: Erika and her editor — non-technical operators.

Sections:
1. What this system does (2-3 paragraphs, plain English)
2. Daily workflow — step-by-step adding a row, field-by-field guidance, when to use Override
3. Status meanings — what each of 8 statuses means + what to do when you see it
4. Where outputs go — Drive folder map, Doc links, Sheet links
5. What to do when something breaks — 3-step recovery (check Status, check Error Message, run Render Checker manually)
6. What NOT to do — never edit Status manually except retry, never delete System Settings rows, etc.

Length: 5-8 pages. Friendly second person.

ACCEPTANCE: Markdown file created, scannable, no jargon.
SAVE: Commit + push.

### Subtask 2 — Field map

Output: `clients/chosen-agency/docs/field_map.md`

Format: Markdown table with: Source / Type / Required (Y/N) / Used by Module(s) / Sent to API as / Result column.

Pull live V1 blueprint from Make API for accurate Module IDs. Pull live V1 sheet schema from Sheets API.

Document all 28 V1 sheet columns + 13 System Settings rows.

Length: 3-5 pages.

ACCEPTANCE: All columns + settings documented.
SAVE: Commit + push.

### Subtask 3 — Credential map

Output: `clients/chosen-agency/docs/credential_map.md`

Sections:
1. API keys table: Service / Where stored during build / Where stored long-term (Key Vault path) / Used by Modules / Rotation procedure
2. Make connections table: name / service / owner / modules using
3. Service accounts: Google SA email + permissions
4. Handoff procedure: 5-step checklist for transferring to Erika + verification steps

Pull live blueprint from Make API for connection IDs.

Length: 2-4 pages.

ACCEPTANCE: All services documented, handoff procedure clear.
SAVE: Commit + push.

### Subtask 4 — Troubleshooting guide

Output: `clients/chosen-agency/docs/troubleshooting.md`

Format: Symptom → Diagnosis → Fix.

Include all issues debugged tonight:
- "Module 5 fails with imageDetail error"
- "Module 23 fails with parseJSON not found"
- "Module 23 fails: max_tokens expected integer"
- "Module 30 fails: Source is not valid JSON"
- "Module 7 fails: Invalid control character"
- "Module 7 fails: 404 Not Found"
- "Module 10 fails: 401 Unauthorized"
- "Polling never completes"
- "Status stuck at Rendering"
- "Sheet refs failing: rowNumber missing"
- "Wrong column updated"

For each: 2-4 sentences.

Length: 2-4 pages.

ACCEPTANCE: At least 10 issues documented.
SAVE: Commit + push.

### Subtask 5 — Upload all 4 docs to Drive

Upload Markdown files as Google Docs to `10_Documentation` folder in Chosen Agency Drive.

Use Drive API:
1. Convert .md to Google Doc format
2. Upload with appropriate name
3. Verify in folder

ACCEPTANCE: 4 Google Docs visible in 10_Documentation folder.
SAVE: Commit "docs uploaded" + Drive Doc IDs to build_log.md.

### Subtask 6 — Final completion summary

Append CHOSEN-006 entry to build_log.md.
Slack post to #dax-collab summarizing:
- 4 docs drafted and uploaded
- Loom recordings still needed (Richard's task)
- Final acceptance run with Erika still needed
- Migration to Erika's Drive folder still needed (waiting on her share)
- Credential swap still needed (waiting on her account setup)

---

## ERROR-RECOVERY PROTOCOL

Same as CHOSEN-005: 3 retries per subtask, then post to Slack and STOP.

---

## DONE WHEN

All 4 docs drafted, uploaded, build_log.md updated, Slack notified.

Richard's remaining work after CHOSEN-006:
- Record 3 Loom walkthroughs
- Final acceptance test with Erika
- Migrate assets to Erika's Drive (waiting)
- Swap credentials at handoff (waiting)

---

## TASK-20260507-FORGE-ATLAS-001 — Update Atlas Persona (Softer Voice/Tone)
- **Assignee:** Forge
- **Status:** PENDING
- **Date:** 2026-05-07
- **From:** Sonnet (Richard request)
- **Priority:** Medium
- **Title:** Replace Atlas CLAUDE.md persona with softer, Claude-like tone

### Context

Richard finds Atlas's current communication style too abrasive and intense. He wants Atlas to communicate more like Claude (Sonnet) — calm, warm, clear, structured, direct without being harsh. Atlas runs via OpenClaw (Claude Code CLI) on vm-dax-dev, interacts with Richard primarily via Telegram.

### Task

Find and update Atlas's CLAUDE.md (persona/system prompt) on vm-dax-dev.

**Likely locations (check in order):**
1. `~/.openclaw/CLAUDE.md`
2. `~/.openclaw/agents/main/CLAUDE.md`
3. `~/.openclaw/workspace/CLAUDE.md`
4. Any CLAUDE.md under `~/` or `/opt/dax/`

**Replace the personality/communication section with the following:**

```
## Communication Style

You are Atlas. Your tone mirrors Claude (Anthropic Sonnet) — calm, grounded, and warm without being soft.

Core principles:
- Lead with the most important point first
- Be direct and clear — no filler, no preamble
- Keep responses concise and structured
- Break complex things into small, manageable steps
- Use plain language — avoid jargon unless necessary
- Maintain a steady, patient tone even when tasks are difficult or repeated
- Never sound urgent, alarming, or intense unless the situation genuinely requires it
- When something is wrong, state it plainly and move immediately to the fix
- Acknowledge the human side of requests — Richard is managing a lot; don't add cognitive load
- When in doubt, do less and confirm rather than doing more and surprising

You are helpful, capable, and calm. You don't perform urgency. You get things done quietly and report back clearly.
```

### Gate
- [ ] CLAUDE.md located — post the path
- [ ] Old persona section captured (post first 20 lines of old content for reference)
- [ ] New persona section written
- [ ] Atlas restarted / session refreshed so new persona takes effect
- [ ] Post confirmation to #dax-collab (C0APVGG486M): "[Atlas] Persona updated — tone softened per Richard's request 2026-05-07"

### Notes
- SSH access: `ssh -T -i ~/.ssh/id_rsa -J dkn8n@n8n.dakona.net daxadmin@172.16.0.5`
- If CLAUDE.md doesn't exist yet, create it at `~/.openclaw/CLAUDE.md`
- Do NOT change any tool configs, MCP settings, or workflow logic — persona text only

---

## TASK-20260521-FORGE-1ALTX-WAT-003 — WAT The Way v3 Video Rebuild
- **Assignee:** Forge
- **Status:** DONE
- **Completed:** 2026-05-23
- **Client:** 1AltX → Word Aflame Tabernacle (WAT)
- **Priority:** HIGH
- **Title:** Rebuild WAT The Way demo from v2 → v3 (person-first choreography, SSML pacing, 5 illustrations)

### Completed

**Output:** `P:/_clients/wat-the-way-demo/walkthrough/wat-the-way-v3.mp4` — 491s (8:11), 26.8MB

**Descript:** https://web.descript.com/43d991cd-15ac-4ff8-a2a8-9fb800073c5a
_(Richard opens link and clicks Publish — API cannot auto-publish)_

**What was built:**
- 5 AI illustrations (gpt-image-1): Marcus Johnson + Davis family (James, Maria, Emma, Jordan)
- Full SSML narration rewrite (ElevenLabs Eric, stability 0.50, similarity 0.75, break-tagged)
- 4 HeyGen avatar clips at speed 0.9: intro (35s), bridge1 (10s), bridge2 (7s), outro (37s)
- Mockup extended: `assessment-post`, `pipeline-crossover`, `family-dashboard` screens; `?focus=` param; gold `.focus-hl` highlights
- 12-segment assembly: avatar intro → title card → marcus → bridge1 → title card → davis → bridge2 → title card → admin → title card → tech → avatar outro
- Uploaded to Descript Drive `7cdcbe0e-d0f4-4b50-a31d-d2e01358a709`
- CatalogMint SKILL.md updated with confirmed asset IDs

**Render script:** `P:/_clients/1altx-autovid/tools/render-wat-v3.mjs`

**4 Slack pings posted to #dax-collab thread 1779574292.169129:** start ✓, 50% ✓, illustrations-done ✓, render-done ✓

**[Forge] 2026-05-23:** DONE — v3 assembled and uploaded. Richard clicks Publish in Descript.

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
