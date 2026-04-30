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

### What's working ✅
- Cloud flow JSON schema fully decoded (reference: `judeper/copilot-studio-agent-patterns` and `jonathandhaene/hr-agents-comparison` on GitHub).
- Trigger: `kind: "PowerVirtualAgents"`, type Request, with input schema. Response: `kind: "PowerVirtualAgentsResponseV2"`.
- Workflow row creation via Dataverse Web API works (POST `/workflows` with required fields including managed-property objects for `iscustomizable` / `iscustomprocessingstepallowedforotherpublishers`).
- Solution import via `pac solution import` works end-to-end (workflow `import-dax-solution.yml`). Tool 1 flow is now living in DAX-Dev as workflow id `a3482ab8-ad44-f111-88b4-000d3a36c81b` with all 3 actions (FMP, Finnhub, Respond).
- Tool 1 flow JSON template lives at `power-platform/flows/dax-tools/market-data/flow.json` with `__FMP_API_KEY__` / `__FINNHUB_API_KEY__` placeholders.

### What's blocked ❌
- **Activation**: PATCH statecode=1 returns `0x80060467 — Flow client error … DefinitionRequestMissingFields … missing required field 'definition'`. The Microsoft.Flow runtime's deployment API rejects activation regardless of payload shape. Flow stays in Draft (statecode=0/statuscode=1).
- Tried: SP token, delegated user token, custom-property envelopes, with/without `Scope_*` wrapping, with/without `connectionReferences`, with/without `parameters`, post-`pac solution import` with `--activate-plugins`. All rejected with same error.
- **Agent registration**: not attempted yet. Tables to investigate: `aiplugin`, `aipluginoperation`, `botcomponent` of action kind, `aicopilot_aiplugin`. Likely the M+1 step after activation works.

### Hypotheses to test next session
1. **Microsoft.Flow direct API**: bypass Dataverse PATCH; call `https://{region}.api.flow.microsoft.com/providers/Microsoft.ProcessSimple/environments/{envId}/flows/{flowId}/start?api-version=2016-11-01` directly with a token for `https://service.flow.microsoft.com`. Different envelope, may succeed where PATCH doesn't.
2. **Pre-activated solution import**: include the workflow already in active state in customizations.xml. Tried StateCode=1 in customizations.xml; pac silently kept it Draft. Try `pac solution import --activate-plugins` against a *managed* solution build (zip with `<Managed>1</Managed>`), since managed import might trigger different activation behavior.
3. **OpenAPI custom-connector route instead of cloud flow**: skip the cloud-flow vehicle entirely and register each tool as an OpenAPI plugin operation directly on the Dax agent (`aiplugin` + `aipluginoperation` tables). Bypasses Microsoft.Flow runtime; the agent calls the API directly. Probably the right architecture for HTTP-only tools (1, 6, 7, 11, 12, 14, 15) anyway. M365-connector tools (2-5, 9, 10) still need the cloud-flow vehicle for their connectors.
4. **One UI-built reference flow** (option 3 from "Open question" above) — Richard creates a single empty flow with the trigger in `make.powerautomate.com`, saves, we export, compare envelope to ours. Most likely to surface the missing field/property quickly. Still recommended if and when Richard's well enough.

### Resource state after this session
- Workflow `DAX — Market Data` (id `a3482ab8-ad44-f111-88b4-000d3a36c81b`) — DRAFT, in DAX solution
- Solution `DAX` v1.0.0.0 — bot + 14 botcomponents + 1 workflow
- Test solution zip at `power-platform/solutions/DAX-dev-test.zip` — round-trip-validated import path
- API keys still hardcoded in the live workflow's `clientdata` (FMP + Finnhub strings). Needs refactor to env-var or KV-connector before promotion.
