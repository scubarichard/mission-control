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

## ACTIVE TASKS - TRITON (COMPLETED)

### TASK-20260401-007
- **Assignee:** Triton
- **Status:** DONE
- **Task:** Build ClickUp ↔ GitHub task queue sync daemon

### TASK-20260401-008
- **Assignee:** Triton
- **Status:** DONE
- **Task:** Backfill completed tasks to ClickUp with cost estimates

### TASK-20260401-009
- **Assignee:** Triton
- **Status:** DONE
- **Task:** Implement task-to-cost attribution in cost tracker

### TASK-20260401-010
- **Assignee:** Triton
- **Status:** DONE
- **Task:** Set up ClickUp folder structure (Option C)

### TASK-20260401-011
- **Assignee:** Triton
- **Status:** DONE
- **Task:** Install & configure OpenClaw on Surface Laptop

### TASK-20260401-012
- **Assignee:** Triton
- **Status:** DONE
- **Task:** Configure Dropbox selective sync

### TASK-20260401-013
- **Assignee:** Triton
- **Status:** DONE
- **Task:** Create ~/clients symlink to shared Dropbox

### TASK-20260401-014
- **Assignee:** Triton
- **Status:** DONE
- **Task:** Make shared CLAUDE.md platform-agnostic

---

## ACTIVE TASKS - FORGE (NEW WORK)

### TASK-20260401-015
- **Assignee:** Forge
- **Status:** DONE
- **Priority:** High
- **Task:** Import Diana's vehicle fleet into PNT Vehicles table
- **Context:** 11 vehicles from Viaturas PNT file (C:\Users\18473\Downloads\Viaturas PNT - Nirvana .xlsx, ABR26 tab)
- **Include:** make/model, license plate, pax capacity, bike capacity, inspection dates
- **Client:** PNT

### TASK-20260401-016
- **Assignee:** Forge
- **Status:** DONE
- **Priority:** High
- **Task:** Cross-reference Tour Infos with 233 Tours to fill Region, Duration, Type
- **Context:** Source: C:\Users\18473\Downloads\Tour Infos & Guided Tours.xlsx
- **Match:** by tour name (PNT tab has 90 tours, Base_Tours has 994 rows)
- **Client:** PNT

### TASK-20260401-017
- **Assignee:** Forge
- **Status:** DONE
- **Priority:** Medium
- **Task:** Import Tour Days DB (232 rows) into Tour_Days table
- **Context:** Google Sheet: 1TZVUy7zlWljYKICoRzTb81mftBMHdpIFtyBT4G9shFQ
- **Columns:** ID, Type, Region, Distance, Elevation, Difficulty, Stage Name, Description
- **Client:** PNT

### TASK-20260401-018
- **Assignee:** Forge
- **Status:** BLOCKED
- **Priority:** Medium
- **Blocker:** Waiting for Diana to share permissions
- **Task:** Import Restaurants + Suppliers from Diana's sheets
- **Context:** 5 sheets need "Anyone with link" permission (Vehicles Lisbon/Porto, Restaurants, Suppliers/Taxis, Tours by Type)
- **Current Status:** 400 errors — no access
- **Client:** PNT

### TASK-20260401-019
- **Assignee:** Forge
- **Status:** PENDING
- **Priority:** Low
- **Task:** Check OPT Tyro/Nuvei workflow execution after hourly trigger fires
- **Context:** Files re-uploaded to Google Drive, waiting for hourly poll trigger
- **Verify:** AI transform agent works end-to-end
- **Client:** OPT

---

## REQUEST QUEUE
*Agents: Add requests here. Atlas assigns task numbers.*

(None currently)

---

## DECISION LOG

**2026-04-01 22:11 UTC — Sync Daemon Ownership**
- Decision: Atlas owns ClickUp ↔ GitHub sync daemon
- Implementation: Integrated into 5-min unified poller (task-queue-poll + sync-clickup)
- Status: LIVE

---

## PROTOCOL ENFORCEMENT — ATLAS (2026-04-01 22:21 UTC)

**To: Forge & Triton**

The following protocol is mandatory, effective immediately:

### 1. **Task Number Assignment**
- **ONLY ATLAS assigns task numbers** (format: TASK-YYYYMMDD-NNN)
- Do NOT create your own numbers
- Do NOT guess or estimate next numbers
- Prevents collisions and maintains order

### 2. **Requesting Work**
When you have work to add:
```
REQUEST from [Forge|Triton]: <clear description of work>
```
Atlas will respond within 5 minutes with assigned task number(s).

### 3. **Task Status Updates**
- When starting a task: Comment in TASK_QUEUE.md with "IN_PROGRESS"
- When done: Mark "DONE" and push
- Atlas syncs to ClickUp automatically every 5 minutes
- No manual ClickUp updates needed

### 4. **Blockers**
If blocked:
- Change status to "BLOCKED"
- Add clear reason: "Waiting for X" or "Access denied: Y"
- Atlas will escalate immediately

### 5. **No Duplicate Numbers**
Today's collision (TASK-007-011 used twice) cost 30 minutes of cleanup.
**Never happens again.**

---

**Atlas will enforce this protocol:**
- Monitor every commit for rule violations
- Reject PRs with malformed task numbers
- Alert Richard to any deviations
- Reassign work if protocol not followed

**All agents acknowledge by returning to standard task work. No confirmation needed.**


---

### TASK-20260401-020
- **Assignee:** [PENDING DECISION]
- **Status:** URGENT
- **Priority:** CRITICAL
- **Task:** Complete Sprint 2 PDF Deliverables (4 missing PDFs)
- **Detail:** Accommodations, Services, Bike Rental, Luggage Tags
- **Context:** Richard holding $2,550 invoice pending completion
- **Deliverable:** All 4 PDFs delivered, invoice released
- **Client:** PNT

