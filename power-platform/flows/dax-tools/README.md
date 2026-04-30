# DAX Tools — Power Automate Flows (Phase 2)

15 cloud flows, each registered as a callable action on the Dax Copilot Studio agent.

## Status — 2026-04-30

### Foundation (DONE)
- Publisher `dakona` (prefix `dak`) — Dataverse publisherid `79d67355-ab44-f111-88b4-000d3a36c81b`
- Solution `DAX` (uniquename, version 1.0.0.0) — solutionid `7cd67355-ab44-f111-88b4-000d3a36c81b`
- Dax bot (`389de172-2e44-f111-88b4-000d3a36c81b`) and 14 botcomponents (componenttype 10221/10222) added to DAX solution
- All API keys present in `kvdaxdakonapilot`: `fmp-api-key`, `finnhub-api-key`, `wealthbox-api-key`, `bing-search-key`, `openai-api-key`, `github-token`
- Reference: extracted bot template at run artifact `dax-template` (run 25175252270) — shows the Copilot Studio Bot YAML format used by `pac copilot create` / `pac copilot publish`

### Open question
The cloud flow `workflow.clientdata` JSON schema for the **Copilot Studio "When an agent calls a flow"** trigger is not publicly documented and not present in the extracted Dax template (the bot has no registered flows yet). Three paths to unblock:

1. **Iterative API create**: POST minimal `workflow` records, read errors, refine schema. Slow; many round-trips before a valid flow.
2. **Public sample mining**: search exported solutions on GitHub for an unpacked solution with `Workflows/*.json` containing a Copilot Studio trigger. No matches found in `microsoft/CopilotStudioSamples`, `microsoft/copilot-alm-starter`, or `microsoft/Power-CAT-Copilot-Studio-Kit`.
3. **One UI-built reference flow**: Richard creates a single empty flow with the "Copilot Studio agent calls a flow" trigger in `make.powerautomate.com`, saves it. Nautilus then exports via `pac solution export` to obtain the canonical `clientdata` JSON. ~5 minutes of UI work; unblocks remaining 14 flows entirely.

Recommendation flagged in #dax-collab: option 3 saves likely 1+ session of trial-and-error, but Richard chose option 1 (full automation, no UI).

## Tool inventory (priority order)

| # | Name                  | Backend                                | API key                | M365 connector?      |
|---|-----------------------|----------------------------------------|------------------------|----------------------|
| 1 | Market Data           | FMP + Finnhub                          | `fmp-api-key`, `finnhub-api-key` | no |
| 2 | Email                 | Outlook (read)                         | —                      | yes (Outlook)        |
| 3 | Calendar              | Outlook Calendar (read)                | —                      | yes (Calendar)       |
| 4 | SharePoint Browser    | SharePoint                             | —                      | yes (SharePoint)     |
| 5 | Create Document       | SharePoint                             | —                      | yes (SharePoint)     |
| 6 | Client Lookup         | Wealthbox API                          | `wealthbox-api-key`    | no                   |
| 7 | List Clients          | Wealthbox API                          | `wealthbox-api-key`    | no                   |
| 8 | Meeting Prep          | Compose (Client Lookup + SharePoint)   | (uses 6+4)             | yes                  |
| 9 | Send Email            | Outlook (send)                         | —                      | yes (Outlook)        |
| 10| Manage Calendar       | Calendar (write)                       | —                      | yes (Calendar)       |
| 11| Market Summary        | Bing News                              | `bing-search-key`      | no                   |
| 12| Research and Write    | Azure OpenAI + SharePoint              | `openai-api-key`       | yes (SharePoint)     |
| 13| Compliance Flag Check | Custom logic + SharePoint              | —                      | yes (SharePoint)     |
| 14| Generate Reports      | Proxy → n8n.dakona.net/webhook/...     | —                      | no                   |
| 15| GitHub Tool           | GitHub API                             | `github-token`         | no                   |

## Phase 4 caveat (raised, not yet acted on)
Power Automate's M365 connectors run under the **connection owner's** identity (= Richard in dev), not the chatting user's. Fine for dev (single user), but for staging/ICP we'll need to swap M365 connectors for direct Graph HTTP calls with delegated tokens passed from agent context. Re-architecture needed before promotion.

## Next session
1. Create the first cloud flow record via Dataverse API (option 1 from above), iterate against errors until schema is known
2. Once Tool 1 (Market Data) is working end-to-end, template the remaining 14
3. Register flows as actions on the Dax agent (likely via `aicopilot_aiplugin` association table or similar — schema TBD)
4. Test each tool via the chat UI; post pass/fail to #dax-collab per task spec
