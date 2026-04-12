# TASK QUEUE — Mission Control
# Agents poll for PENDING tasks assigned to them. Execute → mark DONE → write results to RESULTS/.

## TASK-PNT-001
STATUS: DONE
TITLE: Gate 4 — Expense + Guide_Payroll E2E test
ASSIGNED_TO: ATLAS
COMPLETED_BY: FORGE
COMPLETED_DATE: 2026-04-11

## TASK-1ALTX-001
STATUS: DONE
TITLE: Redesign n8n 7B — Pure Scorer (Claude Sonnet via Anthropic API)
ASSIGNED_TO: FORGE
COMPLETED_BY: FORGE
COMPLETED_DATE: 2026-04-12
RESULTS_FILE: RESULTS/task_1altx_001_results.md

## TASK-1ALTX-003
STATUS: DONE
TITLE: Add new columns to Upwork Log Google Sheet (1AltX - 07)
ASSIGNED_TO: FORGE
COMPLETED_BY: FORGE
COMPLETED_DATE: 2026-04-12
RESULTS_FILE: RESULTS/task_1altx_003_results.md
NOTES: 14 columns added (V:AI), widths set, row 1 frozen. 7B scorer updated to write all new fields.

## TASK-1ALTX-002
STATUS: DONE
TITLE: Fix broken Descript URL + Validate all catalog video URLs
ASSIGNED_TO: FORGE
COMPLETED_BY: FORGE
COMPLETED_DATE: 2026-04-12
RESULTS_FILE: RESULTS/task_1altx_002_results.md
NOTES: All 13 Descript URLs return 200 OK. YouTube link OK (303 redirect). AI Blog Post Generator URL was valid — issue was in catalog text reference only.

## TASK-1ALTX-004
STATUS: IN_PROGRESS
TITLE: Build n8n 7C — Proposal Prep Package (Claude-powered, manual trigger)
ASSIGNED_TO: FORGE
INSTANCE: dakona
RESULTS_FILE: RESULTS/task_1altx_004_results.md

CONTEXT:
  7C is a new n8n workflow that generates a complete proposal prep package for a single
  Upwork job row. Triggered manually by Richard passing in a row number via webhook.
  Reads job from sheet, calls Claude Sonnet, writes back Video Script, Cover Letter,
  and Red Flags. Posts Slack notification when ready.

  WEBHOOK: POST https://n8n.dakona.net/webhook/7c-proposal-prep  body: {"row_number": N}
  SHEET: 11cydvXB7zb38FGSqrLTXEnikIK5gec1FSe3nK3Hy_BY / UpWork_Log
  CREDS: Google Sheets fhAvmmHWXh2VIsWu, Anthropic vayh9kFZH9BfJFdU
  SLACK: #dax-collab C0APVGG486M

  See full spec in git history (previous version of this file) or RESULTS/task_1altx_004_results.md

## TASK-1ALTX-005
STATUS: PENDING
TITLE: Build n8n 7D — Daily 7am Slack Digest of Top 5 Jobs
ASSIGNED_TO: FORGE
INSTANCE: dakona
RESULTS_FILE: RESULTS/task_1altx_005_results.md

CONTEXT:
  7D runs daily at 7am CST. Reads Upwork Log, finds Hot/Apply jobs without proposals sent,
  ranks by Combined Score, posts top 5 digest to #dax-collab with Upwork links and 7C trigger instructions.

  SHEET: 11cydvXB7zb38FGSqrLTXEnikIK5gec1FSe3nK3Hy_BY / UpWork_Log
  CREDS: Google Sheets fhAvmmHWXh2VIsWu
  SLACK: #dax-collab C0APVGG486M
  SCHEDULE: 7:00 AM America/Chicago, daily

  See full spec in git history or RESULTS/task_1altx_005_results.md
