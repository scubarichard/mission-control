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

---

## TASK-002
- **Assignee:** Forge
- **Status:** DONE
- **From:** Forge (pre-loaded)
- **Priority:** High
- **Task:** Extract api.js from booking-intake.html. Move all airtableFetch() calls and API config (WORKER_URL, BASE_ID, DATA_URL, META_URL) into a shared js/api.js module. Update booking-intake.html to import it. Test that booking form still works end-to-end. Push and bump build version.
- **Context:** Step 1 of Wednesday PNT portal refactor. Must complete before Triton can start manifest.html. Repo: scubarichard/pnt-central-brain

---

## TASK-003
- **Assignee:** Forge
- **Status:** DONE
- **From:** Forge (pre-loaded)
- **Priority:** High
- **Depends:** TASK-002
- **Task:** Extract auth.js (PIN gate logic + session management) from booking-intake.html into js/auth.js. Create portal.html with main menu (Bookings + Transfer Manifest). Rename booking-intake.html to booking.html. Wire imports. Test full flow: PIN → portal → booking. Push and bump build version.
- **Context:** Step 2-4 of portal refactor. Post to Slack when done so Triton knows portal is ready.

---

## TASK-004
- **Assignee:** Triton
- **Status:** BLOCKED
- **From:** Forge (pre-loaded)
- **Priority:** High
- **Depends:** TASK-002
- **Task:** Build manifest.html — Transfer Manifest page. Import js/api.js for Airtable calls. Date range picker (flatpickr). Query Transfers filtered by date range, pull linked Tour_Days, Booking, Taxi_Vendor, Taxi_Route. Display grouped by date then route. Flag consolidation candidates (same date + route + compatible service). Read-only. Print button. Push and bump build version.
- **Context:** Step 6 of portal refactor. Can start as soon as TASK-002 is done (api.js available). Use pnt-api.dakona.net Worker for all API calls.

---

## TASK-005
- **Assignee:** Atlas
- **Status:** PENDING
- **From:** Forge (pre-loaded)
- **Priority:** Medium
- **Task:** Post 8am CT standup to #alerts with Wednesday PNT build plan. Monitor #dax-collab for TASK-002/003/004 completion posts. Update ClickUp PNT list (901711746841) as tasks complete. Ping Richard on Telegram only for decisions or blockers stalled 30+ min.
- **Context:** Wednesday build day coordination. Forge handles portal refactor, Triton handles manifest page. Atlas monitors and reports.

---

## TASK-006
- **Assignee:** Forge
- **Status:** PENDING
- **From:** Forge (pre-loaded)
- **Priority:** Medium
- **Depends:** TASK-003, TASK-004
- **Task:** Full integration test — PIN → portal → booking (verify no regressions) AND PIN → portal → manifest (verify Triton's page works). Fix any issues. Final build version bump and push. Post completion summary to Slack and Telegram.
- **Context:** Final step. Only run after both TASK-003 and TASK-004 are DONE.
