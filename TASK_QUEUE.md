# TASK QUEUE — PNT Central Brain
# Dax (Sonnet) writes tasks here. Atlas executes and writes results to RESULTS/.
# Atlas: on each poll, pick up tasks with STATUS: PENDING (not HOLD), run them, update STATUS, write results.

## TASK-PNT-001
STATUS: HOLD
TITLE: Gate 4 — Expense + Guide_Payroll E2E test
ASSIGNED_TO: ATLAS
SCRIPT: scripts/gate4_test.py
RESULTS_FILE: RESULTS/gate4_results.md
HOLD_REASON: Waiting for Richard to add select options in Airtable UI:
  1. Expenses table → Category field → add: Guide, Hotel, Taxi, Bike, Supplier
  2. Expenses table → Paid By field → add: PNT, Guide
INSTRUCTIONS:
  Step 1 — Get the Airtable token from the Windows desktop:
    Run via desktop_run_powershell:
      $raw = Get-Content "P:\_clients\pnt-central-brain\.env" -Raw -Encoding UTF8
      $token = ($raw -split "`n" | Where-Object { $_ -match "AIRTABLE" } | Select-Object -First 1) -replace ".*=", "" -replace "\s", ""
      Write-Host $token
  Step 2 — Replace TOKEN in scripts/gate4_test.py with the value from Step 1
  Step 3 — Run: python3 /repo/scripts/gate4_test.py
  Step 4 — Results auto-written to /repo/RESULTS/gate4_results.md
  Step 5 — Post results to #dax-collab (C0APVGG486M) on Slack
  Step 6 — Update this task STATUS to DONE
TRIGGER: Richard will post "gate4 go" in #dax-collab when Airtable options are added
