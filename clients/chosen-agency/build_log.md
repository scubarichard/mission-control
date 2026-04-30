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
