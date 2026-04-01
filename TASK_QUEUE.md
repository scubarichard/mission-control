# Agent Task Queue - v2.0
**Protocol Updated: 2026-04-01**

## NEW PROTOCOL
- **ATLAS assigns ALL task numbers** (format: TASK-YYYYMMDD-NNN)
- **Agents REQUEST tasks** via: "REQUEST: <description>"
- **Never create your own task numbers**

## Status Codes
- PENDING: Ready to work
- IN_PROGRESS: Being worked
- DONE: Complete
- BLOCKED: Waiting on dependency

---

## ACTIVE TASKS

### TASK-20260401-001
- **Assignee:** Forge
- **Status:** PENDING
- **Priority:** Medium
- **Task:** Add RPE case study to 1altx.com
- **Context:** Full case study at vm-dax-dev:/home/daxadmin/.openclaw/workspace/CASE_STUDY_RPE.md
- **Deliverable:** Live page on 1altx.com

---

### TASK-20260401-002
- **Assignee:** Forge
- **Status:** BLOCKED
- **Priority:** Medium
- **Task:** Build LinkedIn prospect list for 1AltX
- **Context:** Need LinkedIn Sales Navigator access or API
- **Blocker:** No LinkedIn credentials available
- **Deliverable:** 50 prospects with GoHighLevel focus

---

### TASK-20260401-003
- **Assignee:** Forge
- **Status:** PENDING
- **Priority:** Medium
- **Task:** Create PNT case study
- **Context:** Document 97-task automation for Professional Netting Training
- **Deliverable:** Case study markdown + live page

---

### TASK-20260401-004
- **Assignee:** Forge
- **Status:** PENDING
- **Priority:** High
- **Task:** Implement automatic model selection for ATLAS
- **Context:** Files at vm-dax-dev:/home/daxadmin/.openclaw/workspace/MODELS.md and model_selector.py
- **Deliverable:** ATLAS auto-selecting models based on task complexity

---

### TASK-20260401-005
- **Assignee:** Forge
- **Status:** PENDING
- **Priority:** High
- **Task:** Add cost tracking widget to Mission Control
- **Context:** Widget code at mission_control_cost_widget.jsx
- **Deliverable:** Live cost tracking on control.1altx.ai

---

### TASK-20260401-006
- **Assignee:** Forge
- **Status:** PENDING
- **Priority:** High
- **Task:** Implement client-based cost tracking
- **Context:** Enhanced cost_tracker_v2.js with per-client budgets
- **Deliverable:** Client cost breakdown on dashboard

---

## COMPLETED TODAY
- TASK-001 through TASK-014: Various PNT portal refactors (DONE by Forge/Triton)

## REQUEST QUEUE
*Agents: Add your requests here. Atlas will assign task numbers.*

Example:
```
REQUEST from Forge: Need to update n8n workflows for OPT commission tracking
REQUEST from Triton: Research Airtable API v2 migration path
```
