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
- **Status:** DONE
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
- **Status:** DONE
- **Priority:** Medium
- **Task:** Create PNT case study
- **Context:** Document 97-task automation for Professional Netting Training
- **Deliverable:** Case study markdown + live page

---

### TASK-20260401-004
- **Assignee:** Forge
- **Status:** DONE
- **Priority:** High
- **Task:** Implement automatic model selection for ATLAS
- **Context:** Files at vm-dax-dev:/home/daxadmin/.openclaw/workspace/MODELS.md and model_selector.py
- **Deliverable:** ATLAS auto-selecting models based on task complexity

---

### TASK-20260401-005
- **Assignee:** Forge
- **Status:** DONE
- **Priority:** High
- **Task:** Add cost tracking widget to Mission Control
- **Context:** Widget code at mission_control_cost_widget.jsx
- **Deliverable:** Live cost tracking on control.1altx.ai

---

### TASK-20260401-006
- **Assignee:** Forge
- **Status:** DONE
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

---

### TASK-20260401-007
- **Assignee:** Triton
- **Status:** DONE
- **Priority:** High
- **Task:** Build ClickUp ↔ GitHub task queue sync daemon
- **Context:** Sync TASK_QUEUE.md to ClickUp every 5 minutes. When task marked DONE in GitHub, auto-complete in ClickUp. When task created in ClickUp, auto-add to GitHub queue.
- **Implementation:**
  1. Create Node.js sync script using ClickUp API
  2. Poll GitHub TASK_QUEUE.md every 5 minutes
  3. Update ClickUp list 901712338015 (DAX Post v1.0) with task status
  4. Handle bi-directional updates without conflicts
  5. Run as cron job on vm-dax-dev
- **Testing:** Sync 3 test tasks back and forth
- **Deliverable:** Live sync between GitHub and ClickUp, no manual updates needed

---

### TASK-20260401-008
- **Assignee:** Triton
- **Status:** DONE
- **Priority:** High
- **Task:** Backfill completed tasks (001-014) into ClickUp with cost estimates
- **Context:** Historical tasks from today need to be in ClickUp with metadata. Estimate costs based on task complexity and model used.
- **Implementation:**
  1. Create 14 task records in ClickUp for historical work
  2. Estimate API cost for each task (simple=Haiku, standard=Sonnet, complex=Opus)
  3. Add cost estimate to task description
  4. Mark as DONE with completion date
  5. Tag with appropriate client (PNT, OPT, 1ALTX, etc.)
- **Deliverable:** All historical tasks in ClickUp with cost data

---

### TASK-20260401-009
- **Assignee:** Triton
- **Status:** PENDING
- **Priority:** High
- **Task:** Implement task-to-cost attribution in cost tracker
- **Context:** Enhance cost_tracker_v2.js to tag every API call with task ID. When task completes, aggregate total cost and write to ClickUp.
- **Implementation:**
  1. Update cost event structure: include task_id field
  2. Store cost events indexed by task_id
  3. At task completion, sum all costs for that task
  4. Write final cost to ClickUp custom field "API_Cost"
  5. Calculate margin: (revenue - api_cost) / revenue * 100
- **Testing:** Run a test task, verify cost accumulates and writes to ClickUp
- **Deliverable:** True cost per task, visible in ClickUp


---

### TASK-20260401-010
- **Assignee:** Triton
- **Status:** IN_PROGRESS
- **Priority:** High
- **Task:** Set up ClickUp folder structure (Option C) for task tracking
- **Context:** Create client folders in 1AltX workspace with shared custom fields for cost attribution
- **Structure:**
  ```
  1AltX (Workspace)
  ├── Clients (Folder)
  │   ├── PNT (List) - Professional Netting Training
  │   ├── RPE (List) - Atlanta Flooring Solutions
  │   ├── OPT (List) - Optimization Project
  │   ├── ADAM (List) - Paylidify Projects
  │   ├── Heartland (List) - Heartland Project
  │   ├── BrokerBin (List) - BrokerBin Project
  │   └── DAX (List) - DAX Product
  ├── Master Task Queue (List) - Syncs with GitHub
  └── Internal (List) - Heartbeats, monitoring
  ```
- **Custom Fields (apply to all lists):**
  - API_Cost (Currency)
  - Task_ID (Text) — GitHub task link
  - Client (Single Select)
  - Model_Used (Single Select) — Haiku/Sonnet/Opus/GPT-4o
  - Revenue (Currency) — for margin calculation
  - Margin % (Formula) — (Revenue - API_Cost) / Revenue
- **Implementation:**
  1. Create Clients folder
  2. Create 7 lists (one per client)
  3. Add custom fields to workspace (applies to all)
  4. Create filtered views per client
  5. Set up Master Task Queue list for sync
- **Deliverable:** Clean ClickUp structure ready for cost tracking

