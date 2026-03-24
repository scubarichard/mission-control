# DAX Audit Logging Standard

Every n8n workflow that reads or writes client data MUST log the action
to Wealthbox as a Note on the client's record.

## Logging is required for:
- `generate_quarterly_reports` — log per client after each document saved
- `get_client_info` — log after returning client profile
- `get_meeting_prep` — log after returning meeting brief
- `list_clients` — log when filters are applied (not for "show all")
- Any future workflow that reads/writes a specific client record

## Logging is NOT required for:
- `get_market_data` — no client data involved
- Router/AI Agent workflow — routing only

## The logging pattern (async, non-blocking):
```javascript
// Fire-and-forget — never blocks the response
auditLog(contactId, "Action Label", "Summary text", {});

function auditLog(contactId, action, summary, details) {
  var d = JSON.stringify({
    content: "[DAX] " + action + "\nDate: " + timestamp + "\nAdvisor: Brett Stone\n" + summary,
    linked_to: [{ id: contactId, type: "Contact" }],
    tags: [{ name: "DAX" }, { name: "Automated" }]
  });
  var req = https.request({ hostname: "api.crmworkspace.com", path: "/v1/notes", method: "POST",
    headers: { "ACCESS_TOKEN": "<key>", "Content-Type": "application/json", "Content-Length": d.length }
  }, function() {});
  req.on("error", function() {});
  req.write(d); req.end();
}
```

## Action labels:
- `Client Profile Accessed` — get_client_info
- `Meeting Prep Brief Accessed` — get_meeting_prep
- `Quarterly Review Generated` — generate_quarterly_reports
- `Client List Searched` — list_clients (filtered only)
- `Report Downloaded` — future
- `Client Email Drafted` — future
- `Calendar Checked` — future

## What gets written to Wealthbox:
Every log creates a Note on the client's Wealthbox record tagged with
`[DAX]` and `[Automated]`. The note includes:
- Timestamp (America/Chicago timezone)
- Advisor name
- Action taken
- Relevant data fields

This satisfies SEC Rule 204-2 record-keeping requirements for
AI-assisted advisor actions.

## Compliance test:
For any new workflow, ask: "Does this workflow read or write anything
about a specific client?" If yes → it must log to Wealthbox.
