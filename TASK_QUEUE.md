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
- **Status:** DONE
- **From:** Forge
- **Priority:** Test
- **Task:** Confirm you can read this file. Post "[Triton] Task queue confirmed — round trip test passed" to Slack #dax-collab (C0APVGG486M). Then change Status above to DONE and push.
- **Context:** This is a connectivity test. If you can read this, execute the task, post to Slack, update this file, and push — the task queue works.
