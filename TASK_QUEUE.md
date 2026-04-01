# Agent Task Queue

Tasks are written by Atlas or Forge. Agents poll this file and execute tasks assigned to them.

## Format
- Status: PENDING | IN_PROGRESS | DONE | BLOCKED
- Assignee picks up PENDING tasks with their name
- Mark IN_PROGRESS when starting, DONE when complete
- Push after each status change

---

## TASK-001
- **Assignee:** Triton
- **Status:** PENDING
- **From:** Forge
- **Priority:** Test
- **Task:** Confirm you can read this file. Post "[Triton] Task queue confirmed â€” round trip test passed" to Slack #dax-collab (C0APVGG486M). Then change Status above to DONE and push.
- **Context:** This is a connectivity test. If you can read this, execute the task, post to Slack, update this file, and push â€” the task queue works.

---

## TASK-Q-OPT-001
- **Assignee:** Forge
- **Status:** PENDING
- **From:** Sonnet (Richard)
- **Priority:** High
- **Task:** Build AI field mapping agent for OPT Solutions n8n commission import workflows
- **ClickUp:** https://app.clickup.com/t/86e0p98ex
- **Context:**
  Replace the hardcoded Transform & Aggregate Code node in both OPT n8n workflows with a Claude API agent that intelligently reads raw spreadsheet rows and maps them dynamically — no more hardcoded column names.

  Workflows:
  - OPT - Tyro Commission Import: jAnB7P91n3QNs2f0
  - OPT - Nuvei Commission Import: tn5po4OsAjQ2S2HV
  - Node to replace: Transform & Aggregate in both

  n8n API: https://n8n.dakona.net
  n8n Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiM2UyNzA5OWItYTJkMy00MzM1LTgzYTAtOTFkYzk3MTIwM2EzIiwiaWF0IjoxNzczOTI2NzQ1fQ.-aJelQYwEppObYhbPmrr5Hp2U_g1lFy6EdiV6rMvWlw
  PUT body must be ONLY: { name, nodes, connections, settings: { executionOrder: "v1" } }

  The new Code node logic is in #dax-collab (see Sonnet's message from today).
  Agent code template is also at /repo/scripts/opt/ai-transform-agent.js (stub — needs Anthropic key).

  Anthropic API key: find in mcp/.env or Key Vault (kvdaxdakonapilot) as secret anthropic-api-key.

  Use same Node.js PUT pattern from /repo/scripts/opt/update_nuvei_workflow.js — that pattern is proven working.

- **Done When:**
  - Both workflows updated and active
  - Transform node type is n8n-nodes-base.code
  - Code contains Claude API call to anthropic.com/v1/messages
  - Report back verification output to #dax-collab
  - Save final script to /repo/scripts/opt/ai-transform-agent.js and commit to git
