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

REQUEST from Triton: Make shared CLAUDE.md at ~/clients/ platform-agnostic (remove Windows paths, use relative paths). Keep agent-specific config in local ~/.claude/projects/ memory. Symlink created: ~/clients → ~/Dropbox/Companies/1AltX/Projects/_clients. Forge needs equivalent symlink or P: drive mapping on Windows.

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
- **Status:** DONE
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
- **Status:** DONE
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


---

### TASK-20260401-011
- **Assignee:** Triton
- **Status:** DONE
- **Priority:** High
- **Task:** Install & configure OpenClaw on Surface Laptop
- **Context:** Deploy OpenClaw with Sonnet model, systemd node service, Telegram bot connectivity
- **Deliverable:** Surface Laptop running OpenClaw, monitoring #dax-collab in real-time

---

### TASK-20260401-012
- **Assignee:** Triton
- **Status:** DONE
- **Priority:** High
- **Task:** Configure Dropbox selective sync
- **Context:** Sync only Companies/1AltX and Companies/Dakona folders to conserve local storage
- **Deliverable:** Selective sync active, reduces disk footprint

---

### TASK-20260401-013
- **Assignee:** Triton
- **Status:** DONE
- **Priority:** High
- **Task:** Create ~/clients symlink to shared Dropbox directory
- **Context:** Link ~/clients → ~/Dropbox/Companies/1AltX/Projects/_clients for unified client access
- **Deliverable:** Symlink created, agents can access shared client repos

---

### TASK-20260401-014
- **Assignee:** Triton
- **Status:** DONE
- **Priority:** High
- **Task:** Make shared CLAUDE.md platform-agnostic
- **Context:** Remove Windows-only paths (P:\ drive), use relative paths, platform-independent config
- **Deliverable:** CLAUDE.md works on Windows, macOS, and Linux


---

### TASK-20260401-007
- **Assignee:** Forge
- **Status:** PENDING
- **Priority:** High
- **Task:** Import Diana's vehicle fleet into PNT Vehicles table. 11 vehicles from Viaturas PNT file. Include: make/model, license plate, pax capacity, bike capacity, inspection dates.
- **Context:** Source: C:\Users\18473\Downloads\Viaturas PNT - Nirvana .xlsx (ABR26 tab + Fleet Cards tab)

### TASK-20260401-008
- **Assignee:** Forge
- **Status:** PENDING
- **Priority:** High
- **Task:** Cross-reference Tour Infos xlsx (PNT tab + Base_Tours tab) with our 233 Tours to fill Region, Duration, Type. Match by tour name.
- **Context:** Source: C:\Users\18473\Downloads\Tour Infos & Guided Tours.xlsx. PNT tab has 90 tours with Type. Base_Tours has 994 rows with Type+Country.

### TASK-20260401-009
- **Assignee:** Forge
- **Status:** PENDING
- **Priority:** Medium
- **Task:** Import Tour Days DB (232 rows) into Tour_Days table. Has ID, Type, Region, Distance, Elevation, Difficulty, Stage Name, Description.
- **Context:** Accessible Google Sheet: 1TZVUy7zlWljYKICoRzTb81mftBMHdpIFtyBT4G9shFQ

### TASK-20260401-010
- **Assignee:** Forge
- **Status:** PENDING
- **Priority:** Medium
- **Depends:** Diana sharing permissions
- **Task:** Import Restaurants + Suppliers from Diana's sheets once shared. 5 sheets need "Anyone with link" permission.
- **Context:** Vehicles Lisbon/Porto, Restaurants, Suppliers/Taxis, Tours by Type — all 400 errors currently.

### TASK-20260401-011
- **Assignee:** Forge
- **Status:** PENDING
- **Priority:** Low
- **Task:** Check OPT Tyro/Nuvei workflow execution after hourly trigger fires. Verify AI transform agent works end-to-end.
- **Context:** Files re-uploaded to Google Drive, waiting for hourly poll trigger.
