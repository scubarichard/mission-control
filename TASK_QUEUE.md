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
- **Title:** Azure Monitor + n8n error alerting for DAX (Dakona + ICP)

### Completed
Full error monitoring system built across both DAX environments:

**Azure Monitor — Dakona (rg-dax-dakona-pilot, DAKONA 001)**
- Action Group: ag-dax-alerts → dax@dakona.com + n8n webhook
- Alert rules (Log Search, 5-min eval, 15-min window):
  - DAX-LibreChat-Errors (Sev2) — >5 errors in container logs
  - DAX-Auth-Failures (Sev2) — >10 auth/401/403 events
  - DAX-Revision-Failed (Sev1) — any container crash/OOM in system logs
  - DAX-N8n-Errors (Sev2) — n8n container error spike

**Azure Monitor — ICP (rg-dax-impact-capital, Azure subscription 1)**
- Action Group: ag-dax-icp-alerts → dax@dakona.com + n8n webhook
- Alert rules (same structure):
  - DAX-ICP-Errors (Sev2)
  - DAX-ICP-Auth-Failures (Sev2)
  - DAX-ICP-Revision-Failed (Sev1)
- Note: separate action group required — cross-tenant AG references blocked by Azure

**n8n — DAX Alert Router (kZs3ly1mrZtZPsDp)**
- Receives Azure Monitor webhooks → formats → posts to Slack #alerts
- Skips Resolved alerts (only fires on active)
- Active at https://n8n.dakona.net/webhook/dax-alert

**n8n — DAX Error Handler (jqqz9K51fdtrU8Zf)**
- Error Trigger workflow — catches failed n8n workflow executions
- Posts to Slack #alerts with workflow name, error message, execution URL
- Wired as errorWorkflow on: DAX Alert Router, DAX Inbox Inbound Handler, DAX Inbox Confirm and Execute, PNT Generate Invoice PDF
- DAX Router - AI Agent (3tniyxZREqfnAbfo) skipped — body too large for n8n PUT parser

**[Forge] 2026-04-17:** DONE — 7 alert rules live, 2 action groups, error handler active.
