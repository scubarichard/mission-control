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
STATUS: PENDING
TITLE: Fix broken Descript URL + Validate all catalog video URLs
ASSIGNED_TO: FORGE
RESULTS_FILE: RESULTS/task_1altx_002_results.md

CONTEXT:
  The v7B catalog has a broken URL for AI Blog Post Generator (missing "://").
  Validate all catalog video URLs using Descript API token stored in Key Vault.

INSTRUCTIONS:

  Step 1 — Retrieve Descript API token from Key Vault: kvdaxdakonapilot
    Secret name: descript-api-token (check what was stored today by Forge)

  Step 2 — Validate each Descript share URL:
    GET https://api.descript.com/v1/shares/{slug}
    Header: Authorization: Bearer {token}

    Slugs to check:
    1. ABKZceXd0Nb — Close → ClickUp
    2. GHAniAOOOMi — Close → AgencyHandy
    3. 7pXYtY3rkS0 — Smart Email Intake Logger
    4. FpwC1PVwVXD — Sheets → PDF/DocuSeal
    5. LTlgrCwvApn — AI Blog Post Generator (BROKEN URL — fix to https://share.descript.com/view/LTlgrCwvApn)
    6. BBtAerH09Pw — Ringover Webhook Listener
    7. jd63cps0mFR — CSV → Apps Script
    8. pbww9DFL3rB — Shopify Top 30
    9. bM7pKU2xDQb — Shopify Matrixify
    10. WVXVxNabluX — MSP PSA Export
    11. vaGxMaxD5iz — Pipedrive → Zendesk
    12. PXEQP53oS9e — Receipt Submission
    13. V5kA5MV1mdx — Google Form → PDF
    14. https://youtu.be/5u251ivIyI8 — Smart Email Parser (YouTube — just HTTP GET check)

  Step 3 — Write results table to RESULTS/task_1altx_002_results.md
  Step 4 — Post summary to #dax-collab (C0APVGG486M)
  Step 5 — Update STATUS to DONE

## TASK-1ALTX-004
STATUS: PENDING
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
