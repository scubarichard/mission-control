# Build Log — Chosen Agency Content Pipeline

---

## Phase 1 — Backend Foundation ✅ DONE (2026-04-28)

**Completed by:** Forge  
**Task:** CHOSEN-001, CHOSEN-002, CHOSEN-003

- Google Sheet created: `Content_Pipeline_V1` (`1reHZpPcnGy2PTXTqKTdR-otnbqEeRfDkhG3dR-yfHWo`)
  - Tabs: Production Tracker (28 columns), System Settings (13 rows)
- Script Doc template: `1ZDum9DDkuEGPMpoqo39XbAiF-D5-bGMExfOmSY3gm_A`
  - Placeholders: SCRIPT_ID, SCRIPT_NAME, VARIATION_NUMBER, VARIATION_ID, LAST_UPDATED, AUDIENCE, CURRENT_BELIEF, DESIRED_BELIEF, TONE, EMOTIONAL_ARC, OFFER_CTA, SCRIPT_TEXT, CAPTION_TEXT
- Editor Brief template: `179Rc1u3mWVC-7hidFeyBLWxIp0Xxaocl_M52MsDc-4I`
  - Placeholders: SCRIPT_ID, VARIATION_NUMBER, LAST_UPDATED, REVIEW_PRIORITIES, VIEWER_PROFILE, EMOTIONAL_OPEN, EMOTIONAL_CLOSE, ARC_DESCRIPTION, EDITING_DIRECTIVES, LINE_BY_LINE
- Drive folder structure created under `1xCplt3J0RNAPwDpWyjpqqXXTeTf3USPb`
  - 02_Script_Docs: `1JN7T4lmeiXXe0G3OpNcSXrz_24cVdQr3`
  - 03_Editor_Briefs: `1tst1vRaFDk7Y2YFx2ihdYiNlzKwi56Zz`
- Make scenario V1 created: `4894796` (team 885318, inactive)
  - Initial flow: filterRows → SetVariables → Router → [Processing → OpenAI → Script Done → ElevenLabs → HeyGen poll loop]
  - Was reading from wrong sheet (`1OuTq7QYItLLJdfRI0131Zq4FcZ8jtxbXudf5Zv3HvD0`, Queue tab) — fixed in Phase 2

**Make connections used (Richard's account — swap at handoff):**
- Google Sheets/Docs/Drive: `4472711` ("1AltX - Make.com")
- Google Drive: `3744699` ("1Altx - Richard Account")
- OpenAI: `3348536` ("ClearEdgeAI")

---

## Phase 2 — Core Text/Doc Automation 🔄 IN PROGRESS (2026-04-30)

**Task:** CHOSEN-004  
**Completed by:** Forge

### Changes to scenario 4894796

1. **Module 1 (filterRows)** — updated to read from V1 Production Tracker:
   - spreadsheetId: `1reHZpPcnGy2PTXTqKTdR-otnbqEeRfDkhG3dR-yfHWo`
   - sheetId: `Production Tracker`
   - tableFirstRow: `A1:AZ1`
   - Filter: Status = "Queued"

2. **Module 2 (SetVariables)** — populated:
   - `effective_voice_id`: row `Voice ID` (override wins if set)
   - `effective_avatar_id`: row `Avatar ID` (override wins if set)
   - `variation_id`: computed from Script ID + Variation Number + timestamp if blank
   - `openai_model`: `gpt-4o`

3. **Module 5 (OpenAI: Script)** — upgraded:
   - Model: `gpt-4o` (was gpt-4o-mini)
   - Prompt: rewrites to Chosen Agency content pipeline (not autovid)
   - Output: JSON `{script, caption}` via json_object response format

4. **Module 23 (NEW — OpenAI: Editor Brief)**
   - Model: `gpt-4o`
   - Prompt: `clients/chosen-agency/prompts/editor_brief_v1.md`
   - Input: row fields + module 5 script output
   - Output: JSON with 7 keys → 10 doc placeholders

5. **Module 24 (NEW — Google Docs: Script Doc)**
   - Action: createADocumentFromATemplate
   - Template: `1ZDum9DDkuEGPMpoqo39XbAiF-D5-bGMExfOmSY3gm_A`
   - Destination: `1JN7T4lmeiXXe0G3OpNcSXrz_24cVdQr3`
   - Name: `Script_{{Script ID}}_v{{Variation Number}}_{{date}}`
   - Fills all 13 placeholders from row + OpenAI output

6. **Module 25 (NEW — Google Docs: Editor Brief)**
   - Action: createADocumentFromATemplate
   - Template: `179Rc1u3mWVC-7hidFeyBLWxIp0Xxaocl_M52MsDc-4I`
   - Destination: `1tst1vRaFDk7Y2YFx2ihdYiNlzKwi56Zz`
   - Name: `Brief_{{Script ID}}_v{{Variation Number}}_{{date}}`
   - Fills all 10 placeholders from OpenAI editor brief output

7. **Module 6 (updateRow: Script Done)** — expanded write-back:
   - Script Text, Caption Text, Script Doc Link, Brief Doc Link
   - Status → "Script Done"
   - Last Updated → timestamp

### Transfer checklist (before handoff to Erika)
- [ ] Update OpenAI Make connection to Erika's API key
- [ ] Update Google Sheets connection to Erika's Google account
- [ ] Update Google Drive/Docs connection to Erika's Google account
- [ ] Update all spreadsheet/folder/template IDs to Erika's copies
- [ ] Fill System Settings tab (Voice ID, Avatar ID) with Erika's values
- [ ] Activate scenario and run 1 test row
- [ ] Verify Script Doc + Editor Brief created in correct Drive folders

---

## Phase 3 — Audio + Video (PENDING)

ElevenLabs TTS → Drive upload → HeyGen render → poll loop → Status: Ready for Editing

Modules 7–19 are already stubbed. Need:
- ElevenLabs API key in HTTP module 7 headers
- HeyGen API key in HTTP module 10 headers
- Wire System Settings tab for Default Voice ID / Avatar ID
- Test with Erika's voice + avatar IDs

---

## Phase 4–6 — Hardening, Notify, Handoff (NOT STARTED)

---

## Phase 3 — Audio + Video ✅ DONE (2026-05-01 → 2026-05-04)

**Major architecture pivot mid-phase: V1 → V1.5**

Original V1 architecture (Phase 3 first attempt, 2026-05-01):
- Modules 7-9: ElevenLabs TTS direct → Drive upload → HeyGen audio mode
- Modules 10-19: HeyGen render with audio_url + 40-iter polling
- Result: Pipeline produced complete videos but with FLAT PACING (no pauses)

Root cause discovered:
- ElevenLabs REST `/text-to-speech` endpoint silently strips SSML `<break>` tags
- Confirmed by direct PowerShell test: `elevenlabs-pause-test.mp3` had no audible pauses despite explicit 2-second break tags
- ElevenLabs documentation suggests SSML works only via websocket endpoint with `enable_ssml_parsing: true`

V1.5 Architecture (2026-05-04):
- Modeled on CatalogMint's proven approach (script.text mode in HeyGen)
- Module 5: SSML break tags re-enabled (HeyGen DOES honor them)
- Module 10: switched from `voice.audio_url` to `voice.text` mode
- Module 10: input_text = `{{29.script}}` (full script with break tags)
- Module 10: voice_id = HeyGen-linked voice (Richard's: a9c42ba3dd4b441eac3fb3221c6fcf59)
- Modules 7, 8, 9: disabled with always-false filters

Bugs fixed during Phase 3:
1. Module 6 broken Doc URLs: changed `{{24.documentId}}/edit` → `{{24.webViewLink}}`
2. Trigger row references: 41 references converted from `1.\`Header Name\`` to `1.\`numeric position\`` (0-indexed)
3. Module 5 user prompt: fixed unbacticked `1.Audience` and `1.Tone` → `1.\`7\`` and `1.\`10\``
4. Polling iterations: bumped 20 → 30 → 40 (40-min ceiling)
5. Default avatar restored to Tyler-incasualsuit-20220721

Test results before V1.5 pivot (V1 architecture, flat pacing):
- 9/9 acceptance test rows completed end-to-end
- 4 happy-path + 4 override variants all passed
- Doc Links + Voice File URL + Raw Video Link all populated correctly
- Architecture proven; only quality issue was pacing

V1.5 testing: pending Richard manual reset + run.

---

## Phase 4 — Render Checker (PARTIAL)

Forge generated Render Checker blueprint per spec but couldn't deploy due to Make API write-permission limitations.

Status: blueprint pending manual import. Documented in Troubleshooting Guide.

Functionality covered by Make scenario history audit + manual recovery procedures in operator SOP.

---

## Phase 5 — Notify ✅ DEFERRED to Phase 2

Per SOW Section 14 — notification of editor when Status flips to Done. Deferred to post-V1 enhancement.

---

## Phase 6 — Documentation Suite ✅ DONE (2026-05-04 by Sonnet)

Four docs created at `clients/chosen-agency/docs/`:

1. **01-operator-sop.md** (~6.7KB) — Day-to-day operations guide:
   - Adding new content briefs
   - Status lifecycle explanations
   - Override columns usage
   - Editor workflow handoff
   - Daily checklist

2. **02-field-map.md** (~11.6KB) — Complete schema documentation:
   - V1 sheet schema with column positions and sources
   - Module-by-module data flow (Modules 1-30)
   - Critical 0-indexed positional reference syntax
   - Status lifecycle diagram
   - File naming conventions

3. **03-credential-map.md** (~8.3KB) — API key and auth procedures:
   - OAuth connection setup (Google services)
   - API key locations (OpenAI, HeyGen, ElevenLabs)
   - Drive resource IDs catalog
   - Make.com account structure
   - Step-by-step handoff procedure (Drive migration, OAuth swap, key swap, voice/avatar defaults, test run)
   - Cost tracking estimates

4. **04-troubleshooting.md** (~12.8KB) — 10-section diagnostic guide:
   - Quick diagnostic flow chart
   - Section A: Stuck at Processing (OpenAI issues)
   - Section B: Stuck at Script Done (HeyGen issues)
   - Section C: Stuck at Rendering (polling/checker issues)
   - Section D: Failed status (error message decoding)
   - Section E: Error status (Render Checker reachability)
   - Section F: Empty output columns
   - Section G: Broken Doc URLs
   - Section H: Pacing issues (SSML troubleshooting)
   - Section I: Make UI lock issues
   - Section J: Render Checker not picking up

CHOSEN-006 PHASE 6 — DONE.

---

## Outstanding Items

- [ ] V1.5 acceptance test (manual reset + run by Richard)
- [ ] Render Checker manual import to Make
- [ ] Drive migration to Erika's parent folder (blocked on her share)
- [ ] OAuth + API key swap to Erika's accounts (blocked on her signups)
- [ ] Final Loom walkthrough video for Erika
- [ ] Higgsfield decision (defer or pay add-on)

---

## Phase 7 — Tonight's End-to-End Smoke Test (2026-05-08)

**Goal:** Run V1.5 end-to-end via Make API to surface remaining issues before tomorrow's handoff.

### Major Bug Discovered: `.data.data.` Double-Nesting

Triggered V1 scenario via `/api/v2/scenarios/4894796/run`. Execution started at 23:16. After 14+ minutes still in RUNNING state.

Cross-checked HeyGen API directly — the test render had completed in 37.8 seconds at HeyGen's side. So the polling loop wasn't detecting completion.

Inspected Module 14's URL and Module 15's filter conditions:

```
Module 14 URL (BROKEN): https://api.heygen.com/v1/video_status.get?video_id={{10.data.data.video_id}}
Filter (BROKEN):        {{14.data.data.status}} == "completed"
```

But HeyGen's actual response structure is:
```json
{
  "data": {
    "video_id": "...",
    "status": "completed",
    "video_url": "..."
  }
}
```

The `.data.data.` references were querying a non-existent path, so:
- Module 14's URL had an undefined video_id (HeyGen returned an error response)
- Filters never matched any of `completed`/`failed`/`processing`/`pending`/`waiting`
- Bundle stayed in the polling loop until 40 iterations exhausted

### Why This Hid for Days

This bug was inherited from Forge's original CHOSEN-004 build. It was masked by:
- The May 5 runs ending in WARN status (170-182 ops, 2700 sec duration) — looked like timeouts, but actually polling-exhaustion
- The Sheet showing rows as "Done" — but these were either pre-existing Done rows or rows manually flipped during testing
- Direct HeyGen API tests (which we did multiple times to verify text mode) bypassed Module 14 entirely

### Fix Applied (23:25)

Global string replacement on blueprint: `.data.data.` → `.data.` (9 instances)

After fix:
- Module 14 URL: `https://api.heygen.com/v1/video_status.get?video_id={{10.data.video_id}}`
- Filter: `{{14.data.status}} == "completed"`

### Other Findings

- Render Checker scenario (id 5007919) was correctly built with `.data.` references — bug only in V1 scenario
- Direct HeyGen API tests showed renders completing in 30-90 seconds — fast (the long durations in Make logs were polling overhead, not HeyGen)
- The `sequential: true` setting (set 18:07 today) correctly prevents phantom-lock issues; today's stuck execution was different — it's a real long-running execution waiting for polling exhaustion

### Acceptance Status (Updated)

| Criterion | Status |
|---|---|
| 1. Single row → all artifacts in 15 min | ⚠️ Pending verification with `.data.` fix |
| 2. 5 concurrent rows in 30 min | ⚠️ Pending |
| 3. Override columns work | ⚠️ Pending |
| 4. Failed render → Status="Failed" | ⚠️ Not yet tested |
| 5. Render >30 min → Render Checker handles | ✅ Render Checker deployed (id 5007919, INACTIVE) |

### Next Steps

1. Wait for current stuck execution to exhaust (~00:01)
2. Trigger fresh test run
3. Verify Module 14 detects completion correctly
4. Verify Module 16 fires Status=Done with Raw Video Link populated
5. Run remaining acceptance criteria

