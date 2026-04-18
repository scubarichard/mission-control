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
