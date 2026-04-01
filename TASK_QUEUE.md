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
- **Status:** DONE
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
- **Status:** DONE
- **From:** Forge (pre-loaded)
- **Priority:** Medium
- **Depends:** TASK-003, TASK-004
- **Task:** Full integration test — PIN → portal → booking (verify no regressions) AND PIN → portal → manifest (verify Triton's page works). Fix any issues. Final build version bump and push. Post completion summary to Slack and Telegram.
- **Context:** Final step. Only run after both TASK-003 and TASK-004 are DONE.

---

## NOTE FROM FORGE (2026-04-01 ~23:00 CT)
TASK-002 and TASK-003 are DONE. Portal structure changed — PIN gate is now on portal.html.
Triton: git pull before starting TASK-004. Import js/api.js + js/auth.js. Call isAuthenticated() on load — redirect to portal.html if false. Call discoverSchema() before queries. See Slack post for full details.

---

## TASK-007
- **Assignee:** Forge
- **Status:** BLOCKED
- **From:** Richard
- **Priority:** High
- **Task:** Build n8n workflow: daily 6am CT scheduled trigger, query Transfers for today's date, group by route, post summary to Slack #central_brain. Include pax count, booking refs, vendor, consolidation candidates.
- **Context:** Sprint 2 Transfer Manifest automation. Portal is primary UI, this is the daily Slack notification.

---

## TASK-008
- **Assignee:** Forge
- **Status:** DONE
- **From:** Richard
- **Priority:** High
- **Depends:** TASK-007
- **Task:** Build n8n workflow: when Booking_Hotels has 2+ hotels, auto-create Transfer records. Match Hotel A checkout location → Hotel B checkin location against Taxi_Routes via Route Code. Auto-populate price from route, set status to Pending Confirmation.
- **Context:** Sprint 2 inter-hotel transfer auto-creation.

---

## TASK-009
- **Assignee:** Forge
- **Status:** DONE
- **From:** Richard
- **Priority:** High
- **Depends:** TASK-008
- **Task:** Build n8n workflow: on booking Release event, lock Total Cost on all linked Booking_Hotels records. Copy current rate to a Locked Rate field, set Rate Locked checkbox. Future rate changes must not affect confirmed bookings.
- **Context:** Sprint 2 hotel rate locking.

---

## TASK-010
- **Assignee:** Forge
- **Status:** DONE
- **From:** Richard
- **Priority:** Medium
- **Task:** Rename booking-intake.html to booking.html. Update portal.html link. Update GHL iframe snippet. Push to GitHub Pages. Verify no regressions.
- **Context:** Sprint 2 cleanup. GHL iframe URL will need manual update in GHL after this.

---

## TASK-011
- **Assignee:** Triton
- **Status:** IN_PROGRESS
- **From:** Richard
- **Priority:** High
- **Task:** Fix control.1altx.ai 404 after Cloudflare Access auth. The tunnel route was registered via cloudflared CLI but returns 404 after Google auth. DNS points to n8n tunnel (66b223b6). Mission Control runs on vm-dax-dev:3002, SSH tunneled to n8n:3002. Config is correct in /etc/cloudflared/config.yml. Diagnose and fix the post-auth 404.
- **Context:** Mission Control was moved from desktop to vm-dax-dev tonight. Tunnel serves other hostnames fine (n8n.dakona.net, openclaw.dakona.net). Only control.1altx.ai and dax.dakona.net 404 after auth.
