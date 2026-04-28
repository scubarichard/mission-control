# Chosen Agency — Content Pipeline V1 Build Log

---

## TASK-20260428-FORGE-CHOSEN-001 — Editor Brief Prompt
**Status:** DONE  
**Date:** 2026-04-28  
**Agent:** Forge

### Deliverables
- `clients/chosen-agency/prompts/editor_brief_v1.md` — Final OpenAI prompt (system + user message, Make.com HTTP body format, parse notes)
- `clients/chosen-agency/prompts/notes.md` — Design decisions, cost data, iteration log, flags for Richard/Erika
- `clients/chosen-agency/prompts/samples/test_1.md` — Sleep tips script (frustrated→hopeful) — PASS
- `clients/chosen-agency/prompts/samples/test_2.md` — Content creator pitch (overwhelmed→in-control) — PASS
- `clients/chosen-agency/prompts/samples/test_3.md` — Agency authority script (skeptical→curious) — PASS

### Key Decisions
- Model: gpt-4o (working assumption — **Erika must confirm before production wiring**)
- Temperature: 0.7
- Average cost: ~$0.010/brief
- AI avatar context line was the single largest quality improvement (v1→v2)

---

## TASK-20260428-FORGE-CHOSEN-002 — V1 Build Foundation
**Status:** IN PROGRESS (subtask 4 blocked)  
**Date:** 2026-04-28  
**Agent:** Forge

### Subtask 1 — Production Tracker Google Sheet ✅ DONE
**Spreadsheet:** Content_Pipeline_V1  
**ID:** `1reHZpPcnGy2PTXTqKTdR-otnbqEeRfDkhG3dR-yfHWo`  
**URL:** https://docs.google.com/spreadsheets/d/1reHZpPcnGy2PTXTqKTdR-otnbqEeRfDkhG3dR-yfHWo  
**Location:** Chosen Agency → 01_Production_Tracker_Backend folder (ID: 1xCplt3J0RNAPwDpWyjpqqXXTeTf3USPb)

Tabs created:
- **Queue** — 28 columns (A–AB), frozen header row, bold+gray header, Status dropdown (Queued/Processing/Rendering/Ready for Editing/Editing/Ready for QA/Done/Error)
- **System Settings** — 5 columns, 13 default rows (Voice ×6, Avatar ×4, Prompt ×3), frozen header, Active checkbox validation

**Credential note:** n8n's `googleSheetsOAuth2Api` credential is expired. Used Google service account `n8n-sheets@positive-bonbon-478413-p1.iam.gserviceaccount.com` (Key Vault: `google-sa-pvc-sheets`) via Python + Sheets API v4. Spreadsheet shared with SA for ongoing access.

### Subtask 2 — Script Doc Template ✅ DONE
**Doc ID:** `1ZDum9DDkuEGPMpoqo39XbAiF-D5-bGMExfOmSY3gm_A`  
**URL:** https://docs.google.com/document/d/1ZDum9DDkuEGPMpoqo39XbAiF-D5-bGMExfOmSY3gm_A

Placeholders inserted:
- Header: `{{SCRIPT_ID}}`, `{{SCRIPT_NAME}}`, `{{VARIATION_NUMBER}}`, `{{VARIATION_ID}}`, `{{LAST_UPDATED}}`
- Creative Brief: `{{AUDIENCE}}`, `{{CURRENT_BELIEF}}`, `{{DESIRED_BELIEF}}`, `{{TONE}}`, `{{EMOTIONAL_ARC}}`, `{{OFFER_CTA}}`
- Script: `{{SCRIPT_TEXT}}`
- Caption: `{{CAPTION_TEXT}}`

### Subtask 3 — Editor Brief Template ✅ DONE
**Doc ID:** `179Rc1u3mWVC-7hidFeyBLWxIp0Xxaocl_M52MsDc-4I`  
**URL:** https://docs.google.com/document/d/179Rc1u3mWVC-7hidFeyBLWxIp0Xxaocl_M52MsDc-4I

Placeholders inserted (matching `editor_brief_v1.md`):
- Header: `{{SCRIPT_ID}}`, `{{VARIATION_NUMBER}}`, `{{LAST_UPDATED}}`
- Review Priorities: `{{REVIEW_PRIORITIES}}`
- Customer Avatar: `{{VIEWER_PROFILE}}`, `{{EMOTIONAL_OPEN}}`, `{{EMOTIONAL_CLOSE}}`, `{{ARC_DESCRIPTION}}`
- Editing Directives: `{{EDITING_DIRECTIVES}}`
- Line-by-Line: `{{LINE_BY_LINE}}`

### Subtask 4 — Clone Make Scenario ⚠️ BLOCKED
**Source scenario:** 4820264 ("Chosen Agency — Content Pipeline (Test)")  
**Target name:** "Chosen Agency — Content Pipeline V1"

**Blocker:** `make-api-key` in Key Vault (`kvdaxdakonapilot`) returns `SC401 Access denied` for all write operations (clone, create). Key is read-scoped only (or expired for write scope). MCP server's internal token can read scenarios but cannot clone.

**Action needed:** Richard to either:
1. Manually clone scenario 4820264 in Make UI and rename to "Chosen Agency — Content Pipeline V1" (2-click operation), OR
2. Provide a Make API token with `scenarios:write` scope

---

## Credential Notes (for Phase 2 builder)

| Credential | Status | Notes |
|---|---|---|
| `googleDriveOAuth2Api` (n8n: `0MjijtGwtAOKVNBE`) | ✅ Working | richard@1altx.com — Drive API only (not Sheets) |
| `googleSheetsOAuth2Api` (n8n: `fhAvmmHWXh2VIsWu`) | ❌ Expired | Returns 401 Invalid Credentials — needs reauth in n8n |
| `google-sa-pvc-sheets` (Key Vault SA) | ✅ Working | `n8n-sheets@positive-bonbon-478413-p1.iam.gserviceaccount.com` — Sheets + Docs API, shared on both templates + tracker |
| `make-api-key` (Key Vault) | ⚠️ Read-only | Reads scenarios, cannot clone/create |

---

## Next Steps — Phase 2

1. **Erika model confirmation** — gpt-4o assumed; required before production Make wiring
2. **Reauth `googleSheetsOAuth2Api`** in n8n — needed for Make.com → Sheets write-back nodes
3. **Clone Make scenario** (subtask 4 above) — 2-click in UI once Richard confirms
4. **Phase 2 build**: Connect Make scenario modules (Sheets trigger → OpenAI → Copy Script Doc → Copy Editor Brief → ElevenLabs → HeyGen → write-back)
