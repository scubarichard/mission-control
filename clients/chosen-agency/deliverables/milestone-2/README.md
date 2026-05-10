# Chosen Agency — Content Pipeline V1
## Deliverable Package

This folder contains everything needed to operate, demo, and document the Chosen Agency content pipeline automation.

---

## What's In This Folder

| File | Purpose |
|---|---|
| `README.md` | This file. Index of what's here. |
| `TECHNICAL_WALKTHROUGH.md` | Full technical reference. Architecture, every scenario, every sheet column, troubleshooting, future improvements. ~3,500 words. |
| `VIDEO_SCRIPT.md` | Narration script for a 7–9 minute walkthrough video. Section-by-section, ready to record or feed to an avatar. |
| `intake-form.html` | The working intake form. Single file, no build step. Drop on any static host. |

---

## How to Use This Package

### Option 1 — Read it
Open `TECHNICAL_WALKTHROUGH.md` for the full picture. Operations team can use it as a runbook.

### Option 2 — Show it
Open `intake-form.html` in any browser. Submit a real brief end-to-end as a live demo. Most compelling demonstration.

### Option 3 — Record it
Feed `VIDEO_SCRIPT.md` to a screen-capture workflow or an AI agent (Descript, HeyGen Video Agent, etc.). The script has timing estimates, B-roll suggestions, and tone direction.

### Option 4 — Hand it off
Send all four files to the client. Everything they need to operate, debug, and extend the system is in here.

---

## Quick Start (For Erika or Anyone New)

1. Open `intake-form.html` in your browser.
2. Fill in the seven required fields (Script Name, Audience, Current Belief, Desired Belief, Tone, Emotional Arc, Offer/CTA).
3. Pick an avatar from the gallery.
4. Click Submit.
5. Wait 5–15 minutes.
6. Open the Google Sheet → Queue tab → find your row → click Raw Video Link.

That's it.

---

## Quick Start (For Your Tech Team)

The system runs on Make.com (us2 region). All five scenarios live in the "Chosen Agency" folder, team ID 885318.

| Scenario | ID | Trigger |
|---|---|---|
| Content Pipeline V1 | 4894796 | On-demand (fired by Intake) |
| HeyGen Webhook Receiver | 5020000 | Webhook (fired by HeyGen) |
| Render Checker | 5021116 | Schedule (every 5 min) |
| Intake Form Receiver | 5021573 | Webhook (fired by form) |
| HeyGen Avatar Lister | 5021656 | Webhook (fired by form) |

Google Sheet ID: `1reHZpPcnGy2PTXTqKTdR-otnbqEeRfDkhG3dR-yfHWo`
Tabs: Queue (work table), Avatars (config), Voices (config), System Settings (defaults).

For full architecture, module-by-module breakdown, and troubleshooting, see `TECHNICAL_WALKTHROUGH.md`.

---

## Support

**Maintainer:** Richard Mabbun
**Email:** richard@1altx.com
**Built by:** 1AltX
**Project:** Upwork Milestone 2, $1,488

---

*Generated 2026-05-10*
