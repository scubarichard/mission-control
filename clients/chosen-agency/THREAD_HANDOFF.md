# Chosen Agency / Erika Cobb V1 — Thread Handoff Prompt

**Use this prompt to start a fresh Claude thread to continue the Chosen Agency V1 build.**

---

## Quick Context

You're continuing work on a $1,488 Upwork build for **Erika Cobb / Chosen Agency**. The system is a Make.com Content Pipeline that takes briefs from a Google Sheet and produces scripts + editor briefs + HeyGen avatar videos.

Milestone 1 ($150) is complete. **Milestone 2 ($1,338) is FUNDED, awaiting delivery.** Erika quoted: *"this is exactly the level of execution and clarity I was looking for"* on Apr 28.

---

## State of Play (as of May 10, 2026 ~13:56 CST)

### What works ✅
- **V1 scenario (id 4894796) is at blueprint v74** — last known working state
- **End-to-end pipeline produces Status=Done with all artifacts** (Script Doc, Editor Brief Doc, HeyGen Raw Video)
- **HeyGen text mode + SSML pacing** confirmed working
- **`__ROW_NUMBER__` field bug fixed** (required Module 1 re-save in Make UI to regenerate metadata)
- **`.data.data.` references are CORRECT** — Make wraps HTTP responses in outer `data` field, HeyGen returns inner `data` field
- **`sequential: true`** set on V1 scenario metadata
- All 4 Phase 6 docs committed to git (`clients/chosen-agency/docs/`)
- Render Checker scenario built and deployed (id 5007919, currently INACTIVE — has connection issues to fix)
- Handoff video script committed (`clients/chosen-agency/handoff-video-script.md`)
- HANDOFF_RUNBOOK.md committed (step-by-step migration playbook)

### What's broken/wasteful ⚠️
- **V1 polling loop iterates 40 times even after Status=Done** — uses ~167 ops per row instead of ~12
  - The `is_done` variable + filter pattern doesn't break Make's `BasicRepeater` early
  - Tried fixing with `scope: execution` on Modules 21, 22 — didn't work
- **Row Status flips to Done but the run logs as WARN status** (40 min duration, 167 ops)
  - Outcome is correct (Sheet shows Done) but Make exec history shows yellow warning

### What's the planned fix 🎯
**Webhook callback architecture** to replace polling. Already PARTIALLY BUILT but rolled back at user's request before final integration.

**Webhook architecture state:**
- ✅ Webhook URL exists: `https://hook.us2.make.com/rqhdfwb9222mys1n5es1b8zsrsjpdpy9`
- ✅ Webhook scenario exists: id `5020000` ("Chosen Agency - HeyGen Webhook Receiver"), currently INACTIVE
- ✅ Webhook scenario has 3 modules: trigger + Update Sheet (Done route) + Update Sheet (Failed route)
- ✅ HeyGen `callback_url` parameter accepted by API (verified)
- ✅ HeyGen actually calls back when render completes (verified — webhook scenario received bundle on test render)
- ✅ Sheet update via webhook works end-to-end (verified — Row 3 was successfully updated by webhook)
- ⚠️ Field mappings in webhook scenario are best-guess based on HeyGen docs:
  - `{{1.event_type}}` for status (`avatar_video.success` / `avatar_video.fail`)
  - `{{1.event_data.url}}` for video URL
  - `{{1.event_data.callback_id}}` for row number
  - `{{1.event_data.msg}}` for error message
- ❌ V1 Module 10 was modified to send `callback_url` then ROLLED BACK to v74 (clean state)
- ❌ V1 polling loop still in place — needs to be removed when webhook architecture is finalized

---

## Critical Resources (verbatim)

### Make.com
- **V1 scenario:** `4894796` — https://us2.make.com/885318/scenarios/4894796/edit
- **Render Checker scenario:** `5007919` (INACTIVE)
- **Webhook receiver scenario:** `5020000` (INACTIVE) — https://us2.make.com/885318/scenarios/5020000/edit
- **Webhook URL:** `https://hook.us2.make.com/rqhdfwb9222mys1n5es1b8zsrsjpdpy9`
- **Webhook hook ID:** `2285825`
- **Make team ID:** `885318`
- **Make org ID:** `5193163` (1AltX)
- **Make folder:** `232853`
- **Make API key in vault:** `kvdaxdakonapilot` / `make-api-key`

### Google Drive
- **Drive parent (Richard's, current):** `1xCplt3J0RNAPwDpWyjpqqXXTeTf3USPb`
- **Drive parent (Erika's, awaiting share):** `17jLeE_EaJMsPHdAFm1uKeGAvubvrqMO0`
- **V1 Production sheet (Content_Pipeline):** `1reHZpPcnGy2PTXTqKTdR-otnbqEeRfDkhG3dR-yfHWo`
- **Script Doc template:** `1ZDum9DDkuEGPMpoqo39XbAiF-D5-bGMExfOmSY3gm_A`
- **Editor Brief Doc template:** `179Rc1u3mWVC-7hidFeyBLWxIp0Xxaocl_M52MsDc-4I`
- **02_Script_Docs folder:** `1JN7T4lmeiXXe0G3OpNcSXrz_24cVdQr3`
- **03_Editor_Briefs folder:** `1tst1vRaFDk7Y2YFx2ihdYiNlzKwi56Zz`

### Make Connections
- **Google connection ID:** `4472711` ("1AltX - Make.com")
- **OpenAI connection ID:** `3348536` ("ClearEdgeAI")

### Credentials
- **HeyGen API key (in `kvdaxdakonapilot` vault):** key name `HEYGEN-API-KEY` — value starts `sk_V2_hgu_k8ZrvzbzULJ_9kthjbeYQyc2MXZM3URBoAHk0VvwZJvD` (CatalogMint key, works)
- **HeyGen Voice ID:** `a9c42ba3dd4b441eac3fb3221c6fcf59` ("Richard's Voice")
- **OpenAI key (in `kvdaximpactcapital` vault):** key name `OPENAI-API-KEY-RICHARD`
- **ElevenLabs key (in `kvdaximpactcapital` vault):** key name `ELEVENLABS-API-KEY`

### Slack
- **Workspace:** 1AltX
- **Channel for Erika comms:** `#dax-collab` (`C0APVGG486M`)

### GitHub
- **Repo:** `scubarichard/dax`
- **Client folder:** `clients/chosen-agency/`

---

## SOW Section 18 Acceptance Criteria

| # | Criterion | Status |
|---|---|---|
| 1 | Single row → all artifacts in 15 min | ✅ PROVEN (May 9, 23:26 run) |
| 2 | 5 concurrent rows in 30 min | ⚠️ Architecturally proven (worked under V1, not formally tested under V1.5) |
| 3 | Override columns work | ⚠️ Architecturally proven (worked under V1, not formally retested) |
| 4 | Failed render → Status=Failed | ⚠️ Not yet tested |
| 5 | Render >30 min → Render Checker handles | ❌ Render Checker has connection issues (3 failed activations May 9 ~23:09) |

---

## Blueprint Version History (for rollback if needed)

- **v62** (May 5, 18:35) — Last fully successful run before today's chaos. Polling exhaustion at 40 iters but row hit Done.
- **v74** (May 9, 23:27) — CURRENT. Same as v62 functionally.
- v75 (May 9, 00:30) — `is_done` execution-scope fix (didn't work)
- v76 (May 10, 13:44) — Module 10 with callback_url (rolled back)

To roll back to any version: `GET /api/v2/scenarios/4894796/blueprint?blueprintId={N}`, then `PATCH /api/v2/scenarios/4894796` with that blueprint.

---

## Recommended Next Steps

### Immediate (when keys arrive from Erika)

**Option A — Finish webhook architecture in Richard's account first, then migrate**

1. Re-add `callback_url` and `callback_id` to V1 Module 10
2. Activate webhook scenario 5020000
3. Trigger V1 test run, verify webhook fires AND Sheet updates
4. Remove polling loop modules from V1 (Modules 12-22)
5. Run final acceptance test (1 row to verify Done in <2 min instead of 40)
6. Migrate to Erika's account (Phase B-E from HANDOFF_RUNBOOK.md)
7. Generate handoff video, send Slack, release milestone

**Option B — Migrate to Erika's account first, then build clean webhook there**

1. Wait for Erika's keys
2. Build webhook scenario fresh in her Make team
3. Build V1 with webhook architecture from start (no polling loop ever)
4. Run acceptance in her clean environment

**Recommended: Option A** — verify webhook works in known environment before transferring complexity. Less risk.

---

## Critical Self-Reminders for Next Thread

1. **DON'T make multiple blueprint edits without testing each one** — May 9 disaster was caused by 11 rapid edits without verification. Each edit, push, test before next.

2. **Make's `BasicRepeater` always iterates N times** — variable filters skip downstream modules but don't terminate loop. Don't waste time trying to make `is_done` patterns work.

3. **`__ROW_NUMBER__` requires Module 1 re-save in UI** — when bundles arrive without this metadata, Make UI has to re-introspect the sheet schema. API alone can't trigger this. Tell user to right-click Module 1 → Replace Module → pick same Google Sheets module if missing.

4. **`.data.data.` references ARE correct** for HeyGen responses through Make's HTTP module. Don't "fix" them.

5. **Sequential: true** prevents phantom-lock issues with run-once button. Already set.

6. **Webhook scenarios need a manual "Run once" in Make UI** before they'll capture incoming payloads automatically. Cannot be done via API alone.

7. **User has medical context** — direct, structured, minimal cognitive load. Reference user's system prompt. Don't overwhelm with options. One clear next step at a time.

8. **Roll back via blueprint version history** when in doubt: API endpoint `GET /api/v2/scenarios/{id}/blueprint?blueprintId={version}`.

---

## How to Read Recent Past Conversations

If you need more context, these were the key transcript files:
- `/mnt/transcripts/2026-05-09-23-00-38-chosen-v15-debug-rollback.txt` — most recent context

Use the `view` tool on transcript files for additional context, or `conversation_search` with keywords.

---

## Active Files in Git Repo

```
clients/chosen-agency/
├── HANDOFF_RUNBOOK.md           # Step-by-step playbook for Erika migration
├── build_log.md                 # Project journey log through Phase 7
├── builder-handoff.md           # Original build spec
├── followups.md                 # Phase 2 deferred items
├── handoff-video-script.md      # Synthetic handoff video script (~340 words)
├── docs/
│   ├── 01-operator-sop.md       # Erika's day-to-day playbook
│   ├── 02-field-map.md          # Column meanings + data flow
│   ├── 03-credential-map.md     # API keys + rotation guide
│   └── 04-troubleshooting.md    # 11 sections of common issues
├── make-blueprints/
│   └── render_checker_blueprint.json
└── prompts/
    └── (OpenAI script + brief prompts)
```

---

## TL;DR for Fresh Claude

You're picking up an Upwork build that's ~95% complete. V1 pipeline works end-to-end (rolled back to known good state v74). The remaining work is:

1. **Implement webhook architecture** (most pieces already built — just needs final integration in V1 Module 10)
2. **Migrate to Erika's account** (when she sends API keys, expected today)
3. **Generate synthetic handoff video** via the V1 pipeline itself
4. **Send Slack + release Upwork milestone**

The user (Richard) is recovering from a stroke and on Keppra/Lexapro — keep responses direct, structured, minimal cognitive load. Read his system prompt thoroughly. **Do not make rapid edits without verifying each step.**

Begin by acknowledging context, then wait for user direction. Don't assume what to do next.
