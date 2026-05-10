# Chosen Agency — Content Pipeline V1
## Technical Walkthrough

**Version:** 1.0
**Date:** May 10, 2026
**Maintainer:** Richard Mabbun (1AltX)
**Client:** Erika Cobb / Chosen Agency
**Project:** Upwork Milestone 2, $1,488

---

## Executive Summary

This system turns a content brief into a finished avatar video — fully automated. An operator submits a form, and the system writes a script with GPT-4o, generates an editor brief, calls HeyGen to render a talking-head video, and updates a Google Sheet with the final video URL. End-to-end time is typically 5–15 minutes.

The system is built from **five Make.com scenarios** working together with **one Google Sheet** (four tabs) and **one HTML intake form**. Three external services do the heavy lifting: OpenAI for scripts, ElevenLabs for voice synthesis, HeyGen for video rendering.

---

## High-Level Architecture

```
┌──────────────────────┐
│  intake-form.html    │  ← Erika fills out the brief
│  (hosted anywhere)   │
└──────────┬───────────┘
           │ HTTPS POST
           ▼
┌──────────────────────────┐
│  Intake Form Receiver    │  Adds row to Queue, fires V1
│  (Scenario 5021573)      │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│  Content Pipeline V1     │  Generates script, brief, voice,
│  (Scenario 4894796)      │  submits to HeyGen
└──────────┬───────────────┘
           │ submits render job
           ▼
       HeyGen API ──── (5–15 min later) ────┐
                                             │ POST callback
                                             ▼
                              ┌──────────────────────────┐
                              │  HeyGen Webhook Receiver │
                              │  (Scenario 5020000)      │
                              └──────────┬───────────────┘
                                         │ updates Queue
                                         ▼
                                  ┌──────────────┐
                                  │ Google Sheet │
                                  │   (Queue)    │
                                  └──────────────┘

              ┌──────────────────────────────┐
              │  Render Checker (backstop)   │  Every 5 min, checks
              │  (Scenario 5021116)          │  any rows still Rendering
              └──────────────────────────────┘
                              and queries HeyGen directly

              ┌──────────────────────────────┐
              │  HeyGen Avatar Lister        │  Public webhook the form
              │  (Scenario 5021656)          │  calls to populate avatar picker
              └──────────────────────────────┘
```

---

## The Five Scenarios

### 1. Intake Form Receiver — `5021573`

**Purpose:** Receive form submissions, write to Queue, trigger V1.

**Trigger:** Webhook (instant). URL: `https://hook.us2.make.com/30h80b30koqjpmd2xknjxrrr686qkxcr`

**Modules (3):**
1. `gateway:CustomWebHook` — accepts the JSON POST from the form
2. `google-sheets:addRow` — appends a new row to the Queue tab with all submitted fields, Status = "Queued"
3. `http:ActionSendData` — POSTs to Make's own API (`/api/v2/scenarios/4894796/run`) to fire the V1 pipeline immediately

**Why on-demand and not polling:** Polling triggers fire every N minutes whether or not there's work. On idle polls, Make occasionally logs a false `BundleValidationError`. By using an event-driven webhook, the scenario only runs when there's a real submission. Zero false errors in execution history.

---

### 2. Content Pipeline V1 — `4894796`

**Purpose:** Convert a Queued row into a script, editor brief, voice file, and HeyGen render submission.

**Trigger:** On-demand only. Fired by the Intake scenario via Make's API.

**Schedule type:** `on-demand` (not polled). `maxResults: 5` (can process up to 5 Queued rows per fire — useful for batch operations).

**Modules (14, in order):**
1. `google-sheets:filterRows` — reads up to 5 Queued rows from the Queue tab (sorted ascending)
2. `util:SetVariables` — computes `effective_voice_id`, `effective_avatar_id`, `variation_id`, `openai_model`. Uses Override columns first, then falls back to Voice ID / Avatar ID columns, then to hardcoded defaults
3. `builtin:BasicRouter` — Duplicate gate (currently single route; duplicate detection is latent)
4. `google-sheets:updateRow` — Status → Processing
5. `openai-gpt-3:CreateCompletion` — Generates Script Text + Caption Text using GPT-4o
6. `json:ParseJSON` — Parses OpenAI's JSON response
7. `openai-gpt-3:CreateCompletion` — Generates Editor Brief using GPT-4o
8. `json:ParseJSON` — Parses brief JSON
9. `google-docs:createADocumentFromTemplate` — Creates a Script Doc from a template, fills in Script + Caption
10. `google-docs:createADocumentFromTemplate` — Creates an Editor Brief Doc from template
11. `google-sheets:updateRow` — Status → Script Done, saves Doc URLs and Script Text
12. `http:ActionSendData` — ElevenLabs `/v1/text-to-speech` — generates voice audio
13. `google-drive:uploadAFile` — Uploads voice MP3 to Drive, gets shareable link
14. `google-sheets:updateRow` — Status → Voice Done, saves Voice File URL
15. `http:ActionSendData` — HeyGen `/v2/video/generate` — submits render job with `callback_url` pointing to Webhook Receiver and `callback_id` set to the row number
16. `google-sheets:updateRow` — Status → Rendering, saves Render Job ID

(End. Polling was removed; render completion is now handled by the webhook.)

**External services hit:** OpenAI (×2), Google Docs (×2), ElevenLabs, Google Drive, HeyGen.

---

### 3. HeyGen Webhook Receiver — `5020000`

**Purpose:** Catch HeyGen's render-complete callback, flip the row to Done (or Error).

**Trigger:** Webhook (instant). URL is configured in V1's M10 as the `callback_url` for HeyGen.

**Modules (3):**
1. `gateway:CustomWebHook` — receives HeyGen's POST
2. `builtin:BasicRouter` — branches on `event_type`
   - **Route 0 (success):** filter `event_type = avatar_video.success`
   - **Route 1 (failure):** filter `event_type = avatar_video.fail`
3. `google-sheets:updateRow` — uses `event_data.callback_id` (= the row number we passed when submitting) to find the right row. On success: writes Status = Done + Raw Video Link. On failure: writes Status = Error + Error Message.

**Why this works:** HeyGen renders are async (5–15 min). Polling for completion was wasteful (60 ops per render, hits a 30-iteration ceiling). With the callback, V1 ends immediately after submission and the webhook fires only when there's actual news. Lower cost, no false ceiling, instant updates.

---

### 4. Render Checker (Backstop) — `5021116`

**Purpose:** Catch rows that are stuck in Rendering because the webhook missed a callback (e.g., webhook scenario was paused, HeyGen retry failed, etc.).

**Trigger:** Scheduled, every 5 minutes.

**Modules (5):**
1. `google-sheets:filterRows` — finds all rows with Status = Rendering
2. `http:ActionSendData` — calls HeyGen `/v1/video_status.get` for each Render Job ID
3. `builtin:BasicRouter` — branches on render status
   - **Route 0 (completed):** filter `status = completed` → updates row to Done with video URL
   - **Route 1 (failed):** filter `status = failed` → updates row to Error
4. (Both routes write back to the Queue sheet.)

**Why a backstop:** Webhooks can fail silently (network blip, Make scenario paused, HeyGen retry exhaustion). The Render Checker is a safety net that polls HeyGen directly for any row still showing Rendering after submission. Belt-and-suspenders.

---

### 5. HeyGen Avatar Lister — `5021656`

**Purpose:** Return HeyGen's full avatar + talking photo catalog so the intake form can populate its picker dynamically.

**Trigger:** Webhook (instant). URL: `https://hook.us2.make.com/axqmbdvrrgohpd4h59xg61sqrfs8tnuk`

**Modules (3):**
1. `gateway:CustomWebHook` — accepts an empty GET request from the form
2. `http:ActionSendData` — calls HeyGen `/v2/avatars` with the API key (key stays server-side)
3. `gateway:WebhookRespond` — returns HeyGen's response with CORS headers (`Access-Control-Allow-Origin: *`)

**Why:** The form needs avatar names + preview images, but the HeyGen API key shouldn't be exposed to the browser. This scenario is a thin server-side proxy. The form fetches once on page load and caches in memory.

---

## The Google Sheet

**Spreadsheet ID:** `1reHZpPcnGy2PTXTqKTdR-otnbqEeRfDkhG3dR-yfHWo`

**Four tabs:**

### Queue (the work table)

28 columns. Each row = one video.

| Col | Header | Used By | Notes |
|---|---|---|---|
| A | Status | All | Queued / Processing / Script Done / Voice Done / Rendering / Done / Error |
| B | Script ID | Intake / V1 | Auto-generated by form if blank |
| C | Script Name | Form | Title of the video |
| D | Variation Number | Form | Defaults to 1 |
| E | Variation ID | V1 (M2) | Computed: ScriptID_v1_TIMESTAMP |
| F | Avatar ID | V1 (M2 fallback) | Read-only fallback if no Override |
| G | Voice ID | V1 (M2 fallback) | Read-only fallback if no Override |
| H | Audience | Form | Who the video is for |
| I | Current Belief | Form | What they believe now |
| J | Desired Belief | Form | What we want them to believe |
| K | Tone | Form | Style descriptor |
| L | Emotional Arc | Form | Journey descriptor |
| M | Offer / CTA | Form | What action to take |
| N | Script Text | V1 (writes) | OpenAI output |
| O | Caption Text | V1 (writes) | OpenAI output |
| P | Override Voice ID | Form | Per-brief voice override |
| Q | Override Avatar ID | Form | Per-brief avatar override |
| R | Override Tone | Form | Per-brief tone override |
| S | Override ElevenLabs Stability | Form | 0.0–1.0 |
| T | Override ElevenLabs Similarity Boost | Form | 0.0–1.0 |
| U | Script Doc Link | V1 (writes) | Google Docs URL |
| V | Brief Doc Link | V1 (writes) | Google Docs URL |
| W | Voice File URL | V1 (writes) | Google Drive URL of MP3 |
| X | Raw Video Link | Webhook / Render Checker (writes) | HeyGen CDN URL |
| Y | Render Job ID | V1 (writes) | HeyGen job ID for status checks |
| Z | Assigned Editor | (manual) | For post-production tracking |
| AA | Error Message | Webhook / Render Checker (writes) | If render failed |
| AB | Last Updated | All writers | Timestamp |

### Avatars (configuration)

Drives the form's avatar picker. Edit this tab to add/remove options without touching code.

| Col | Header | Notes |
|---|---|---|
| A | avatar_id | HeyGen avatar_id or talking_photo_id |
| B | display_name | Shown on the form card |
| C | description | Shown as the card's subtitle |
| D | active | TRUE / FALSE — flip to FALSE to hide without deleting |
| E | sort_order | Ascending number, controls display order |
| F | notes | Internal documentation |

### Voices (configuration)

Drives the form's voice picker.

| Col | Header | Notes |
|---|---|---|
| A | voice_id | ElevenLabs voice ID |
| B | display_name | Shown on the form card |
| C | provider | "ElevenLabs" (label only) |
| D | active | TRUE / FALSE |
| E | sort_order | Ascending |
| F | notes | Internal documentation |

### System Settings (defaults)

Fallback values for the pipeline. Used by V1's M2 if all overrides + per-row values are empty.

---

## The Intake Form

**File:** `intake-form.html` (single file, no build step, no dependencies)

**Hosting:** Drop it on any static host — your domain, Netlify, GitHub Pages, Google Sites, or just open the file locally for testing.

### What the form does on page load

1. Calls the **Avatar Lister webhook** (5021656) → gets full HeyGen catalog
2. Fetches the **Avatars tab** via Google's public gviz JSON endpoint
3. Intersects: only shows avatars where the sheet says `active = TRUE`, with HeyGen's preview images
4. Fetches the **Voices tab** the same way

### What the form does on submit

1. Validates required fields (Script Name, Audience, Current Belief, Desired Belief, Tone, Arc, CTA)
2. Auto-generates a Script ID if the user left it blank (`CA-{slug}-{timestamp}`)
3. Resolves the chosen avatar/voice into the right HeyGen/ElevenLabs ID
4. POSTs JSON to the **Intake webhook** (5021573)
5. Shows a confirmation with the Script ID

### Form sections

1. **Identity** — Script Name, Variation #, optional Script ID
2. **Talent** — Avatar picker, Voice picker
3. **Audience & Belief Shift** — Audience, Current Belief, Desired Belief
4. **Style, Arc & Offer** — Tone, Emotional Arc, Offer/CTA
5. **(Collapsible)** ElevenLabs fine-tuning — Stability, Similarity Boost, Tone Override

### Adding a new avatar

1. Open Google Sheet → **Avatars** tab
2. Add a new row: HeyGen avatar ID, display name, description, `TRUE`, sort number
3. Refresh the form. New avatar appears with HeyGen's preview image automatically.

### Adding a new voice

1. Open Google Sheet → **Voices** tab
2. Add a row: ElevenLabs voice ID, display name, "ElevenLabs", `TRUE`, sort number
3. Refresh the form.

---

## How a Single Brief Flows Through the System

**Time T+0:00** — Erika opens the form, fills it out, clicks Submit.

**T+0:01** — Form POSTs JSON to Intake webhook. Form shows "Submitting…"

**T+0:02** — Intake scenario fires:
- M2 appends a row to Queue with Status = Queued
- M3 calls Make API to trigger V1

**T+0:03** — Form shows success message with Script ID.

**T+0:05** — V1 begins processing:
- Picks up the new Queued row
- Computes effective IDs
- Status → Processing

**T+0:10** — OpenAI generates the script (~5–7 sec).

**T+0:18** — OpenAI generates the editor brief (~7 sec).

**T+0:25** — Two Google Docs created from templates. Status → Script Done.

**T+0:35** — ElevenLabs generates voice audio (~10 sec). Uploaded to Drive. Status → Voice Done.

**T+0:38** — HeyGen submission. Render job ID returned. Status → Rendering.

**T+5:00 to T+15:00** — HeyGen renders the video (variable depending on length).

**T+~10:00** — HeyGen POSTs success callback to Webhook Receiver.

**T+~10:01** — Webhook Receiver finds the matching row by `callback_id` and writes:
- Status → Done
- Raw Video Link populated

**Done.** Erika sees the video link in the sheet. Editor opens the Brief Doc + Voice File + Raw Video to assemble the final cut.

---

## Day-to-Day Operation

### Submitting a brief

Open the form. Fill it out. Submit. That's it. No need to touch the sheet directly.

### Watching the queue

Open the Queue tab. Status column shows where each row is. Most rows go from Queued → Done in 5–15 minutes. If anything sticks at Processing or Rendering for more than 20 minutes, see Troubleshooting.

### Curating avatars/voices

Edit the Avatars and Voices tabs. Set `active = TRUE` to show, `FALSE` to hide. Adjust `sort_order` to reorder. Form picks up changes on the next load (no caching).

### Pausing the system

Two ways:

1. **Soft pause** — turn off Intake Form Receiver scenario. Existing in-flight rows still complete, but new submissions will be silently dropped (the form will still show success but nothing happens). Not recommended.
2. **Form-level pause** — replace the form's webhook URL with a placeholder, or take the form offline. New submissions can't be made, in-flight work continues. Cleanest.

### Resuming

Re-activate the Intake scenario, restore the form. No queue replay needed; rows in flight aren't affected.

---

## Troubleshooting

### "Row stuck at Processing"

V1 hit an error mid-pipeline (OpenAI rate limit, Docs API issue, ElevenLabs failure). The row has no error handler currently — it just stops.

**Fix:** Open V1 in Make, check the failed execution detail to find which module errored. Manually update the row's Status back to Queued and re-fire V1, or escalate to Richard for an error handler patch.

### "Row stuck at Rendering for 30+ min"

HeyGen render took unusually long, or the webhook callback was lost. The Render Checker (5021116) runs every 5 min and should catch this within ~5 min.

**Fix if Render Checker isn't catching it:** Check the Render Checker's execution history. If it's erroring, fix that. Otherwise, manually call HeyGen's status endpoint with the Render Job ID from column Y to see what's actually happening.

### "Form says success but nothing in the sheet"

Intake scenario is paused or broken.

**Fix:** Open Intake Form Receiver scenario in Make, check execution history. If it's not running, reactivate it. If it's erroring, look at the most recent failed execution.

### "Avatar picker shows 'failed: HTTP 500' on the form"

Avatar Lister scenario is paused or broken. Form falls back to the static Default + Custom ID options.

**Fix:** Open Avatar Lister, reactivate or debug.

### "Multiple rows of the same content"

The duplicate gate in V1 is latent (M3 router has only one active route after the polling cleanup). If duplicates become a problem, add a filter on M3 Route 0 that checks Variation ID uniqueness before processing.

---

## Reference: All URLs and IDs

### Make.com Scenarios (folder: Chosen Agency, ID 232853)

| ID | Name | Webhook |
|---|---|---|
| 4894796 | Content Pipeline V1 | (no webhook, fired via API) |
| 5020000 | HeyGen Webhook Receiver | https://hook.us2.make.com/30h80b30koqjpmd2xknjxrrr686qkxcr (no — see HeyGen submit) |
| 5021116 | Render Checker | (scheduled) |
| 5021573 | Intake Form Receiver | https://hook.us2.make.com/30h80b30koqjpmd2xknjxrrr686qkxcr |
| 5021656 | HeyGen Avatar Lister | https://hook.us2.make.com/axqmbdvrrgohpd4h59xg61sqrfs8tnuk |

### Google Sheet

`https://docs.google.com/spreadsheets/d/1reHZpPcnGy2PTXTqKTdR-otnbqEeRfDkhG3dR-yfHWo/edit`

Tabs: Queue, Avatars, Voices, System Settings.

### External APIs

- **OpenAI** — connection ID 3348536 in Make. Model: gpt-4o.
- **ElevenLabs** — API key embedded in V1 M12 HTTP module.
- **HeyGen** — API key embedded in V1 M15 HTTP module and Avatar Lister M2.
- **Google Workspace** — connection IDs 4472711 (Sheets/Docs) and 3744699 (Drive Restricted).

---

## Future Improvements (Phase 2)

These are documented in `clients/chosen-agency/followups.md` for the next iteration:

1. **Error handlers on M5, M7, M12, M15** of V1 — currently a mid-pipeline error leaves the row in limbo. Each module should have an error route that sets Status = Error with the error message.
2. **Move HeyGen API key out of the blueprint** — currently hardcoded in two places. Should be a Make connection or vault reference for clean rotation.
3. **Duplicate gate logic** — V1's M3 router has a latent duplicate-detection branch that's not active. Could prevent re-processing if a row's Variation ID already exists in the sheet.
4. **Voice preview on form** — currently voice cards are text-only. Could add a "play sample" button that fetches a 5-sec preview from ElevenLabs.
5. **Form authentication** — currently the form is unauthenticated. For production, add a simple shared-secret check or hosted auth.

---

## Glossary

- **Bundle** — Make's term for a single record flowing through a scenario.
- **Operation** — Make billing unit; one module run on one bundle = one operation.
- **Webhook** — A URL that, when POSTed to, triggers a Make scenario instantly.
- **Polling trigger** — A scheduled trigger that periodically checks for new data. Has a known false-error issue, replaced here with webhooks.
- **Talking Photo** — HeyGen's term for an avatar generated from a single photo (vs. a full-body avatar).
- **gviz** — Google's visualization API, also serves as a public read-only JSON endpoint for any sheet.

---

*End of walkthrough. Questions: richard@1altx.com*
