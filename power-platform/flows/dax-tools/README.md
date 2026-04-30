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

## Phase 2 status — 2026-04-30 17:30 UTC

### Working pattern (decoded from `microsoft/Power-CAT-Copilot-Studio-Kit`)
1. **POST flow JSON** to Microsoft.Flow API at `https://api.flow.microsoft.com/providers/Microsoft.ProcessSimple/environments/{envId}/flows?api-version=2016-11-01` with body `{"properties": {"displayName": "...", "definition": {...}, "state": "Started", "connectionReferences": {...}}}`. Trigger uses `"type": "Request", "kind": "Skills"`. Response uses `"type": "Response", "kind": "Skills"`. Auto-syncs to Dataverse `workflows` table within ~10s.
2. **Add workflow to DAX solution** (componenttype 29) via `AddSolutionComponent`.
3. **Create action botcomponent** (componenttype 9) with `data` field = TaskDialog YAML containing `action.kind: InvokeFlowTaskAction` and `action.flowId: <workflowid>`.
4. **Associate botcomponent <-> workflow** via N:N table `botcomponent_workflow` ($ref POST).
5. **Add botcomponent to DAX solution** (componenttype 10222).
6. **Manual UI Publish click** on the bot — service-principal `PvaPublish` returns 200 with empty job (no-op). UI is the only working publish path.

`scripts/deploy-dax-tool.py` automates steps 1-5. Reads `flow.json` + `botcomponent.data.yaml` + `secrets.json` from a tool dir; replaces `__SECRET_NAME__` placeholders from KV.

### Earlier dead ends (documented for future-me)
- **Dataverse `workflows` PATCH activation** (`statecode=1, statuscode=2`) → `0x80060467 DefinitionRequestMissingFields` regardless of envelope. The Dataverse layer can't activate cloud flows.
- **Solution import via `pac solution import --activate-plugins`** → imports flow but leaves `state=Stopped`. Activation must be a separate Flow Management API call after import.
- **Trigger kind `PowerVirtualAgents`** (older naming) is rejected by Flow API. Use `Skills`. Both `PowerVirtualAgents` and `Skills` work in solution-import path; only `Skills` works in Flow API direct create.

### Tools deployed (8/15 — all programmatic, no M365 consent needed)

| # | Tool | Workflow ID | Status |
|---|---|---|---|
| 1 | Market Data (FMP + Finnhub) | `b85b3b06-b244-f111-88b4-000d3a36c81b` | ✅ active in env |
| 6 | Client Lookup (Wealthbox) | `7531f8df-b244-f111-88b4-000d3a36c81b` | ✅ active in env |
| 7 | List Clients (Wealthbox) | `666e3a34-b344-f111-88b4-000d3a36c81b` | ✅ active in env |
| 8 | Meeting Prep (Wealthbox composite — defers SharePoint storage) | `606598be-b344-f111-88b4-000d3a36c81b` | ✅ active in env |
| 11 | Market Summary (Bing News + FMP indices) | `72da0243-b344-f111-88b4-000d3a36c81b` | ✅ active in env |
| 12 | Research and Write (OpenAI.com gpt-4o; SharePoint storage deferred) | `109a6f97-b344-f111-88b4-000d3a36c81b` | ✅ active in env |
| 14 | Generate Reports (proxy to n8n schwab-processor) | `cdc30d4a-b344-f111-88b4-000d3a36c81b` | ✅ active in env |
| 15 | GitHub Tool (REST GET) | `202d1459-b344-f111-88b4-000d3a36c81b` | ✅ active in env |

All in DAX solution. Bot publish click in Copilot Studio UI required for them to surface in chat.

### Tools deferred (need user OAuth consent for M365 connectors — can't fully automate without Richard at the keyboard)

| # | Tool | Connector(s) needed |
|---|---|---|
| 2 | Email (read) | Outlook |
| 3 | Calendar (read) | Calendar |
| 4 | SharePoint Browser | SharePoint |
| 5 | Create Document | SharePoint |
| 9 | Send Email | Outlook |
| 10 | Manage Calendar | Calendar |
| 13 | Compliance Flag Check | SharePoint (logging only — could omit and rely on prompt rules) |

**Unblock path**: Richard creates 3 connections in `make.powerautomate.com` (Outlook, Calendar, SharePoint) — one auth flow each, ~30 sec total. Then `deploy-dax-tool.py` adds connection refs to flow JSON for those tools.

**Alternative**: rebuild M365-connector tools as direct Microsoft Graph HTTP calls. Requires Graph app-only permissions on a service principal + admin consent. Gives all-user access (fine for dev where Richard is the only user; unacceptable for staging/ICP). Better long-term path for multi-tenant.

### Phase 2 progress: ~55% by tool count, ~70% by usefulness
The 8 deployed tools cover all market data, all client CRM lookup, meeting prep, generated long-form content, and the n8n proxy. The remaining 7 are M365 productivity tools (read mail, draft email, calendar, SharePoint files) — important but not blocking general DAX usefulness.
