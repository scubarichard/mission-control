# Chosen Agency — Tomorrow Handoff Runbook

**Generated:** 2026-05-08
**Purpose:** Step-by-step playbook for migrating V1 to Erika's account when API keys arrive. Designed for minimum cognitive load.

---

## Prerequisites (Erika provides)

- [ ] OpenAI API key
- [ ] HeyGen API key + a voice ID on her account
- [ ] (Optional) ElevenLabs API key
- [ ] Make.com team access (already done)
- [ ] Drive parent folder share — `17jLeE_EaJMsPHdAFm1uKeGAvubvrqMO0`

---

## Phase A — Pre-Migration Verification (Richard's environment, ~10 min)

**Goal:** Prove V1.5 acceptance in Richard's account before migrating.

### A.1 — Run V1.5 acceptance test (single row)
- **Your:** Open Make, click Run Once
- **Sonnet:** Monitor via API, report when row hits Status=Done

### A.2 — Run failure-path test
- **Your:** No action required
- **Sonnet:** Add test row with bogus avatar_id, click Run Once via API attempt, verify Module 17 fires Status=Failed
- **If automated trigger fails:** Sonnet writes a 1-line "click Run Once" reminder

### A.3 — Run override columns test
- **Your:** No action — rows TEST-OV-001 through OV-004 already in queue
- **Sonnet:** Walk you through clicking Run Once 4 times in succession, monitor each

### A.4 — Verify Render Checker
- **Your:** Activate Render Checker scenario (toggle in Make UI: id `5007919`)
- **Sonnet:** Sets up a deliberately stale `Rendering` row, waits 5 min for RC to flip it

**Time budget:** ~30 min including waits, ~5 min cognitive load

---

## Phase B — Drive Migration (~20 min)

**Goal:** Move all V1 assets from Richard's Drive to Erika's parent folder.

### B.1 — Erika shares parent folder
- Action item: confirm `17jLeE_EaJMsPHdAFm1uKeGAvubvrqMO0` is shared with richard@1altx.com with editor access

### B.2 — Replicate folder structure in Erika's Drive
- **Sonnet:** Via Drive MCP, create:
  - `01_Briefs` (or use existing structure if Erika has)
  - `02_Script_Docs`
  - `03_Editor_Briefs`
  - `04_Voiceover` (legacy, can be empty)
  - `05_Final_Videos`

### B.3 — Move V1 Sheet
- **Sonnet:** Copy "Content_Pipeline" sheet from Richard's Drive to Erika's parent
- **Note new sheet ID** — will replace `1reHZpPcnGy2PTXTqKTdR-otnbqEeRfDkhG3dR-yfHWo` everywhere

### B.4 — Move templates
- Script Doc template → Erika's Drive root (or sub-folder)
- Editor Brief template → same
- **Note new IDs**

### B.5 — Update IDs in Make scenario
- **Sonnet:** Via API, replace 6 IDs in scenarios:
  - V1 sheet ID (in Modules 1, 4, 6, 11, 16, 17)
  - 02_Script_Docs folder ID (Module 24)
  - 03_Editor_Briefs folder ID (Module 25)
  - Script template ID (Module 24)
  - Editor Brief template ID (Module 25)
  - Render Checker sheet ID

**Time budget:** ~20 min wall time, ~3 min cognitive load (just confirming Drive share)

---

## Phase C — Make Migration (~15 min)

**Goal:** Move V1 + Render Checker scenarios into Erika's Make team.

### C.1 — Export V1 blueprint from Richard's team
- **Sonnet:** Pull blueprint via API
- Save copy at `clients/chosen-agency/make-blueprints/v1_richard_export.json`

### C.2 — Erika's Make team ID
- **Your:** Look up her team ID in Make UI (URL: `make.com/{teamId}/scenarios/...`)
- Tell me the team ID

### C.3 — Create scenarios in Erika's team
- **Sonnet:** POST to `/api/v2/scenarios?teamId={erika_team_id}` with each blueprint:
  - V1 Production scenario
  - Render Checker scenario

### C.4 — Set up OAuth connections under Erika's account
- **Your:** This requires UI interaction — when scenario opens, click into a Google Sheets module, click "Add new connection", auth with Erika's Google account
- Three connections needed: Sheets, Drive, Docs
- ~5 min total

### C.5 — Update credentials
- **Your:** Paste OpenAI key into chat
- **Sonnet:** Updates Module 5 + 23 connections via API
- **Your:** Paste HeyGen key into chat (with voice ID if known)
- **Sonnet:** Updates Module 10 + 14 headers via API

**Time budget:** ~15 min wall time, ~10 min cognitive load (paste keys, OAuth clicks)

---

## Phase D — Acceptance in Erika's Environment (~30 min)

**Goal:** Run all 5 SOW Section 18 criteria in Erika's account.

### D.1 — SOW criterion #1: Single row in 15 min
- Add 1 fresh test row to her sheet
- Run Once
- Verify Done within 15 min

### D.2 — SOW criterion #2: 5 concurrent in 30 min
- Add 5 rows, queue all
- Run Once 5 times
- Verify all Done within 30 min

### D.3 — SOW criterion #3: Override columns
- Add row with Override Voice ID
- Add row with Override Avatar ID
- Add row with Override Tone
- Run, verify each respects override

### D.4 — SOW criterion #4: Failed render handling
- Add row with bogus avatar_id (or other guaranteed-fail input)
- Run, verify Status=Failed with Error Message populated

### D.5 — SOW criterion #5: Render Checker handles stuck row
- Already verified in Phase A.4 (just confirm in Erika's env)

**Time budget:** ~30 min wall time, ~5 min cognitive load

---

## Phase E — Final Handoff (~30 min)

### E.1 — Generate synthetic handoff video (Option B chosen)
- **Sonnet:** 
  - Write polished walkthrough script (5-7 min)
  - Run through V1 pipeline itself (eat our own dog food!)
  - Result: HeyGen video walking Erika through her own product
- Upload final video to Erika's Drive

### E.2 — Slack message draft
- **Sonnet:** Drafts polished handoff message
- **Your:** Review, paste, send

### E.3 — Upwork milestone release
- **Erika:** Clicks Release on Milestone 2
- $1,338 lands in your account in ~5 days

**Time budget:** ~30 min, ~5 min cognitive load

---

## TOTAL COGNITIVE BUDGET

| Phase | Wall time | Your time |
|---|---|---|
| A — Pre-migration | 30 min | 5 min |
| B — Drive migration | 20 min | 3 min |
| C — Make migration | 15 min | 10 min |
| D — Acceptance | 30 min | 5 min |
| E — Handoff | 30 min | 5 min |
| **TOTAL** | **~2 hours** | **~28 min** |

---

## Failure Modes & Recovery

### "Erika hasn't shared Drive folder"
- **Action:** Sonnet posts polished reminder to her in Slack
- **Workaround:** Continue Phase C (Make migration) without Drive migration; do Drive migration once shared

### "Erika's HeyGen plan doesn't have Tyler avatar"
- **Action:** Switch Module 10 default to a generic HeyGen avatar (e.g., `Daniel_public_pro2_20240312` or similar)
- **Sonnet:** Pulls voice list from her account, picks suitable replacement, updates

### "Make UI lock recurs"
- **Action:** Already mitigated by `sequential: true` setting, but if it happens:
  - Wait 15 min for Make's lock to clear
  - Or sign out/in
  - Or use API: `POST /api/v2/scenarios/{id}/start` then `POST /stop`

### "OpenAI/HeyGen returns 401 with Erika's keys"
- **Action:** Verify keys typed correctly (no trailing whitespace)
- **Action:** Confirm her plan allows API access (HeyGen needs Creator+ tier)

---

## Status of Pre-Built Assets

✅ **Render Checker scenario:** ID `5007919`, INACTIVE, in Richard's team
✅ **All 4 Phase 6 docs:** committed to git (`clients/chosen-agency/docs/`)
✅ **Followups doc:** committed (`clients/chosen-agency/followups.md`)
✅ **Render Checker blueprint:** committed (`clients/chosen-agency/make-blueprints/render_checker_blueprint.json`)
✅ **V1 scenario:** functional in Richard's team (id 4894796), V1.5 architecture
✅ **build_log.md:** up to date through Phase 6

⚠️ **V1.5 acceptance run:** still pending one fresh successful run (last attempt hit phantom-lock, fixed via `sequential: true`)
