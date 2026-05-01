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

### All 15 tools deployed ✅

| # | Tool | Backend | Workflow ID |
|---|---|---|---|
| 1 | Market Data | FMP + Finnhub HTTP | `b85b3b06-b244-f111-88b4-000d3a36c81b` |
| 2 | Read Email | Microsoft Graph (app-only via DAX-PP-CI) | `8e3a013d-b444-f111-88b4-000d3a36c81b` |
| 3 | Read Calendar | Microsoft Graph (app-only) | `0e263f5c-b444-f111-88b4-000d3a36c81b` |
| 4 | SharePoint Browser | Microsoft Graph (app-only) | `6aa63268-b444-f111-88b4-000d3a36c81b` |
| 5 | Create Document | Microsoft Graph (PUT to SP drive) | `213cf093-b444-f111-88b4-000d3a36c81b` |
| 6 | Client Lookup | Wealthbox API | `7531f8df-b244-f111-88b4-000d3a36c81b` |
| 7 | List Clients | Wealthbox API | `666e3a34-b344-f111-88b4-000d3a36c81b` |
| 8 | Meeting Prep | Wealthbox composite (contacts+notes+tasks) | `606598be-b344-f111-88b4-000d3a36c81b` |
| 9 | Send Email | Microsoft Graph (POST /sendMail) | `ce63a7a0-b444-f111-88b4-000d3a36c81b` |
| 10 | Manage Calendar | Microsoft Graph (POST /events) | `6af31fb0-b444-f111-88b4-000d3a36c81b` |
| 11 | Market Summary | Bing News + FMP indices | `72da0243-b344-f111-88b4-000d3a36c81b` |
| 12 | Research and Write | OpenAI.com gpt-4o | `109a6f97-b344-f111-88b4-000d3a36c81b` |
| 13 | Compliance Flag | SharePoint markdown log via Graph | `dc943bd0-b444-f111-88b4-000d3a36c81b` |
| 14 | Generate Reports | n8n proxy (schwab-processor) | `cdc30d4a-b344-f111-88b4-000d3a36c81b` |
| 15 | GitHub Tool | GitHub REST API | `202d1459-b344-f111-88b4-000d3a36c81b` |

All 15 workflows in DAX-Dev with `state=Started`. All 15 action botcomponents created (componenttype=9, kind:TaskDialog) and N:N-linked to their workflows via `botcomponent_workflow`. All in DAX solution.

### Microsoft Graph app-only auth (Tools 2, 3, 4, 5, 9, 10, 13)
Granted to DAX-PP-CI service principal (`37fe1021-88b3-4744-aa32-b5d7e104462b`) and admin-consented 2026-04-30:
- Mail.Read, Mail.Send
- Calendars.Read, Calendars.ReadWrite
- Files.Read.All, Sites.Read.All

Each flow's first action POSTs to `login.microsoftonline.com/{tenant}/oauth2/v2.0/token` with `grant_type=client_credentials` to get a Graph token, then calls Graph API with `Bearer @{body('Get_Graph_Token')?['access_token']}`. The PP-CI client secret is referenced from KV via `__PP_CI_SECRET__` placeholder → `kvdaxdakonapilot/DAX-PP-CI-ClientSecret`.

**Permission scope = the entire tenant.** Fine for dev (Richard is the only user; flows hardcode his OID `1740bd16-eb72-4ace-913d-96150cec19fd` as the target user). For staging/ICP this needs to change to delegated user identity (passed from agent context) — currently a known Phase 4 blocker.

### Bot publish — FULLY AUTOMATED (corrected 2026-04-30 17:57 UTC)
Earlier this session I dismissed `pac copilot publish` as a no-op. **That was wrong.** pac's console output prints the *prior* publish job's status (e.g. `Failed [04/30/2026 13:12:44]`) which made me think the new publish hadn't fired. It HAD — `bot.publishedon` advances every time the workflow runs.

Trigger from anywhere:
```
gh workflow run publish-copilot-dev.yml --ref master
```

`.github/workflows/publish-copilot-dev.yml` runs `pac copilot publish --bot 389de172-2e44-f111-88b4-000d3a36c81b` under the DAX-PP-CI service principal. ~50 seconds end-to-end.

The Dataverse `bots(...).PvaPublish` action *does* in fact return a no-op — pac uses a different (undocumented) authoring API endpoint that Microsoft hasn't published.

### Smoke-test results (2026-04-30 16:55 UTC)
| Backend | Status | Note |
|---|---|---|
| Finnhub | ✅ | SPY = $714.38 |
| FMP `/stable/quote` | ✅ | Replaces deprecated `/api/v3/quote/` (legacy endpoints retired 2025-08-31). Tool 1 + Tool 11 PATCHed to use new path. |
| FMP `/stable/news/general-latest` | ✅ | Replaces Bing News in Tool 11 — Bing key was 401-ing. |
| Microsoft Graph (app-only) | ✅ | Mail.Read against Richard's mailbox returned messages. |
| Wealthbox | ❌ **401** | KV key `wealthbox-api-key` (created 2026-04-08, 32 chars) returns 401 against `/v1/me` and `/v1/contacts`. Tools 6, 7, 8 deployed but won't work until a valid Wealthbox API key replaces it. Possibly rotated upstream. |
| Bing Search | ❌ 401 | Replaced — no longer needed. KV `bing-search-key` is now unused; safe to delete or leave. |
| OpenAI.com | ✅ | gpt-4o responds. Tool 12 functional. |

### Action items pre-Phase 4
1. Rotate Wealthbox API key (Tools 6, 7, 8 blocked until then)
2. Bot publish click (one-time UI action) to expose all 15 tools
3. Delete unused `bing-search-key` from KV (cosmetic cleanup)
