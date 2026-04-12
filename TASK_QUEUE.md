# TASK QUEUE — Mission Control
# Agents poll for PENDING tasks assigned to them. Execute → mark DONE → write results to RESULTS/.

## TASK-PNT-001
STATUS: DONE
TITLE: Gate 4 — Expense + Guide_Payroll E2E test
ASSIGNED_TO: ATLAS
COMPLETED_BY: FORGE
COMPLETED_DATE: 2026-04-11
NOTES: Gate 4 PASS — completed by Forge during PNT S4 session. All select options added, E2E verified, results posted to #dax-collab.

## TASK-1ALTX-001
STATUS: DONE
TITLE: Redesign n8n 7B — Pure Scorer (Claude Sonnet via Anthropic API)
ASSIGNED_TO: FORGE
COMPLETED_BY: FORGE
COMPLETED_DATE: 2026-04-12
RESULTS_FILE: RESULTS/task_1altx_001_results.md
WORKFLOW_ID: vuzR69FaM306OVWK
INSTANCE: dakona
NOTES: Workflow renamed "1AltX 07B: Pure Scorer (Claude Sonnet)". 4 nodes modified (Build Anthropic Request, Anthropic API Call, Parse Anthropic Response, Map Fields to Sheet). n8n credential "Anthropic API Key" created (httpHeaderAuth, id: vayh9kFZH9BfJFdU). Cover letter removed. New scoring: Job Fit + Client Quality = Combined (0-20). Active, schedule every 15 min. No unprocessed rows at deploy time — will score next new row automatically.

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

## TASK-1ALTX-003
STATUS: PENDING
TITLE: Add new columns to Upwork Log Google Sheet (1AltX - 07)
ASSIGNED_TO: FORGE
RESULTS_FILE: RESULTS/task_1altx_003_results.md

CONTEXT:
  The Upwork Log sheet needs new columns to support the redesigned 7B scorer output.
  Sheet ID: 11cydvXB7zb38FGSqrLTXEnikIK5gec1FSe3nK3Hy_BY
  Tab: UpWork_Log (gid: 388267327)
  Use Google Sheets API via n8n HTTP Request node or desktop PowerShell with gsheets API.

CURRENT COLUMNS (confirmed from sheet read):
  A: Job Title
  B: UpWork Link
  C: DateSubmitted
  D: TimestampCST
  E: Confidence Score
  F: MatchingProject
  G: MakeCom
  H: Google Sheets
  I: Google Docs
  J: Gmail
  K: ChatGPT
  L: GoogleDrive
  M: Other
  N: Status
  O: Notes
  P: Job Link HTML
  Q: Cover Letter
  R: Proposed Rate
  S: Video Script
  T: Processed
  U: Video

NEW COLUMNS TO ADD (append after column U):
  V: Priority Flag        (emoji output: 🔥 Hot / ✅ Apply / ⏭ Skip)
  W: Job Fit Score        (0-10 numeric)
  X: Client Quality Score (0-10 numeric)
  Y: Combined Score       (0-20 numeric)
  Z: Richard Fit Tag      (text category)
  AA: Engagement Type     (One-off / Retainer Potential / Ongoing)
  AB: Competitive Difficulty (Low / Medium / High)
  AC: n8n                 (0 or 1 flag)
  AD: Airtable            (0 or 1 flag)
  AE: Twilio              (0 or 1 flag)
  AF: HubSpot             (0 or 1 flag)
  AG: Scoring Notes       (1-2 sentence note from scorer)
  AH: Proposal Sent       (checkbox — Richard marks manually)
  AI: Outcome             (Won / Lost / No Response — Richard marks manually)

INSTRUCTIONS:

  Step 1 — Use Google Sheets API to append header row values to row 1 of the sheet
    for columns V through AI as listed above.
    Use the existing Google Sheets OAuth credential (id: fhAvmmHWXh2VIsWu)
    via n8n HTTP Request or googleSheets node.

  Step 2 — Set column widths where possible:
    - Priority Flag (V): narrow ~80px
    - Score columns (W,X,Y): narrow ~80px each
    - Richard Fit Tag (Z): medium ~150px
    - Engagement Type (AA): medium ~150px
    - Competitive Difficulty (AB): medium ~120px
    - Scoring Notes (AG): wide ~300px
    - Proposal Sent (AH): narrow ~100px
    - Outcome (AI): medium ~120px

  Step 3 — Freeze row 1 (header row) if not already frozen.

  Step 4 — Post confirmation to #dax-collab (C0APVGG486M) with column mapping summary.

  Step 5 — Update STATUS to DONE and write to RESULTS/task_1altx_003_results.md

IMPORTANT: Do NOT modify any existing data rows or existing column headers.
Only add new headers in row 1 for columns V onward.
