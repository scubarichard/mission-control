# TASK-1ALTX-009 Results — Google Sheets Button for 7C

**Status:** DONE (script ready — Richard pastes via Extensions → Apps Script)
**Completed:** 2026-04-12
**Agent:** FORGE

## Summary

Apps Script created for the Upwork Log sheet. Adds a "1AltX" menu with one-click 7C proposal prep trigger.

## How to Install (Richard — 30 seconds)

1. Open the Upwork Log sheet: https://docs.google.com/spreadsheets/d/11cydvXB7zb38FGSqrLTXEnikIK5gec1FSe3nK3Hy_BY
2. Go to **Extensions → Apps Script**
3. Delete any existing code in the editor
4. Paste the script below
5. Click **Save** (disk icon)
6. Close the Apps Script tab
7. **Refresh the sheet** — the "🎯 1AltX" menu appears in the menu bar

## The Script

```javascript
function trigger7C() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var row = sheet.getActiveCell().getRow();

  if (row <= 1) {
    SpreadsheetApp.getUi().alert('Select a job row first (not the header).');
    return;
  }

  var jobTitle = sheet.getRange(row, 1).getValue();
  var confirm = SpreadsheetApp.getUi().alert(
    '🎯 Run 7C Proposal Prep',
    'Prep proposal for row ' + row + ':\n"' + jobTitle + '"\n\nThis will take ~30 seconds.',
    SpreadsheetApp.getUi().ButtonSet.OK_CANCEL
  );

  if (confirm !== SpreadsheetApp.getUi().Button.OK) return;

  var payload = JSON.stringify({ row_number: row });
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: payload,
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(
      'https://n8n.dakona.net/webhook/7c-proposal-prep',
      options
    );
    var code = response.getResponseCode();
    if (code === 200) {
      SpreadsheetApp.getUi().alert(
        '✅ 7C Complete!',
        'Proposal prep ready for:\n"' + jobTitle + '"\n\nCheck #alerts in Slack.\nCover Letter → column Q\nVideo Script → column T',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } else {
      SpreadsheetApp.getUi().alert('⚠️ 7C returned HTTP ' + code + ': ' + response.getContentText().substring(0, 200));
    }
  } catch(e) {
    SpreadsheetApp.getUi().alert('❌ Error: ' + e.message);
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎯 1AltX')
    .addItem('Run 7C — Prep This Proposal', 'trigger7C')
    .addToUi();
}
```

## How It Works

1. Richard clicks any job row in the sheet
2. Goes to **🎯 1AltX → Run 7C — Prep This Proposal**
3. Confirmation dialog shows job title and row number
4. Clicks OK → calls the 7C webhook with `{"row_number": N}`
5. ~30 seconds later, success dialog confirms completion
6. Cover Letter (Q) and Video Script (T) are populated
7. #alerts gets a Slack notification with the prep summary

## Notes

- The `onOpen()` trigger runs automatically when the sheet is opened — no manual trigger setup needed
- First run will ask Richard to authorize the script (standard Google permissions prompt)
- The script is bound to this specific spreadsheet, not standalone
- Cannot be deployed programmatically without Google Apps Script API OAuth scope — manual paste is the standard approach for bound scripts
