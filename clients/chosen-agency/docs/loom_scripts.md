# Loom Walkthrough Scripts — Chosen Agency V1

Three scripts. Hit record, follow the script, stop. Total recording time across all three: ~12 minutes.

Each script is timed in 30-second blocks for pacing. Read at conversational speed.

---

## LOOM 1 — Full System Walkthrough (5-6 min)

**Open with:** Google Sheet (V1 Production Tracker), Make.com scenarios list, and the Drive folder structure visible in tabs.

### Scene 1 — What this system does (45 sec)
> "Hi Erika, this is Richard. I'm walking you through the V1 content pipeline I built for Chosen Agency.
>
> The system takes a queued row in your Google Sheet, generates a script and editor brief with OpenAI, generates voice audio with ElevenLabs, creates an avatar video with HeyGen, and writes everything back to the sheet so your editor has a ready-to-edit package.
>
> Above 'Ready for Editing' is fully automated. Below it is human/editor work."

### Scene 2 — The sheet (60 sec)
> "Here's your Production Tracker. The Queue tab has 28 columns. The first 14 are inputs you fill in. The middle columns are override settings — Voice ID, Avatar ID, Tone, ElevenLabs settings — that override the global defaults on a per-row basis. The last 8 columns are system-generated: Script Doc Link, Brief Doc Link, Voice File URL, Raw Video Link, Render Job ID, and timestamps.
>
> When you set Status to 'Queued' on a row, the automation picks it up.
>
> The System Settings tab holds your global defaults. Voice settings, avatar settings, prompt settings — change them here and they apply to every row that doesn't have an override."

### Scene 3 — The pipeline (90 sec)
> "Here's the V1 scenario in Make. It runs on a 15-minute schedule and processes up to 5 queued rows per run.
>
> Walk through the modules with the camera:
> - Trigger reads queued rows
> - Set Variables resolves your effective voice and avatar IDs from row override → global default → fallback
> - Router checks for duplicates
> - Status gets flipped to Processing
> - OpenAI generates the script and caption
> - OpenAI generates the editor brief in the four-section structure you specified
> - Google Docs creates the Script Doc and Editor Brief Doc from your templates
> - Status flips to Script Done with the Doc URLs
> - ElevenLabs generates the voice audio using your effective voice ID
> - Drive uploads the audio to the 05_ElevenLabs_Audio folder
> - Status flips to Voice Done with the audio URL
> - HeyGen submits the render with the audio URL and a callback to a webhook
> - Status flips to Rendering
>
> The scenario then ends. HeyGen renders asynchronously."

### Scene 4 — Async completion (45 sec)
> "When HeyGen finishes the render, it posts to the Webhook scenario, which updates the row to 'Done' with the Raw Video Link. This is faster and cheaper than polling.
>
> There's also a Render Checker scenario that runs every 5 minutes and catches any renders that might have missed their callback. It's the safety net."

### Scene 5 — Editor handoff (30 sec)
> "When Status hits 'Ready for Editing', that's where the automation stops and your editor takes over. They'll have the Script Doc, Editor Brief, voice audio, and raw avatar video — everything they need.
>
> Status values from there — Editing, Ready for QA, Done — are manual."

### Scene 6 — Wrap (30 sec)
> "Documentation is in the 10_Documentation folder. Operator SOP, Field Map, Credential Map, and Troubleshooting Guide. Everything an operator needs is there.
>
> Next videos: scenario-level walkthrough, then the daily operator flow. Thanks for watching."

---

## LOOM 2 — V1 Scenario Module-by-Module (4 min)

**Open with:** Make scenario `4894796` open in edit mode.

### Scene 1 — Setup (30 sec)
> "This is a deeper look at the V1 scenario. I'll walk through each module, show you the configuration, and point out the override logic.
>
> The scenario has 22 modules: 14 in the main flow, 5 error handlers, 1 duplicate-gate handler, and 2 control modules."

### Scene 2 — Trigger and config resolution (45 sec)
> "Module 1 reads queued rows from the sheet. Limit is 5 per run, so a single execution processes up to 5 rows.
>
> Module 2 sets variables. The most important ones: 'effective_voice_id' and 'effective_avatar_id'. Each is a chain — first try the row's Override column, then the row's regular column, then a fallback.
>
> This is the override pattern from your spec. Voice and avatar are never hardcoded inside Make modules."

### Scene 3 — Generation modules (75 sec)
> "Modules 5 and 23 are the OpenAI calls. Module 5 generates the script and caption. Module 23 generates the editor brief in your fixed four-section structure: Review Priorities, Customer Avatar, Editing Directives, Line-by-Line.
>
> Modules 24 and 25 create the Script Doc and Editor Brief Doc from your templates. The placeholders fill in automatically.
>
> Module 6 writes Status to 'Script Done' with the Doc URLs.
>
> Module 7 calls ElevenLabs with your effective voice ID. Module 8 uploads the resulting MP3 to your 05_ElevenLabs_Audio folder. Module 9 writes Status to 'Voice Done' with the audio URL.
>
> Module 10 calls HeyGen. The voice section uses 'audio_url' pointing at the ElevenLabs file. So the avatar speaks in your ElevenLabs voice, not HeyGen's built-in voice."

### Scene 4 — Async handoff (30 sec)
> "Module 10 also passes a callback_url to a separate webhook scenario, with the row number as the callback_id. When HeyGen finishes, the webhook updates the right row.
>
> Module 11 writes Status to 'Rendering'. Then this scenario ends."

### Scene 5 — Error handlers (30 sec)
> "Each external API call — OpenAI script, OpenAI brief, ElevenLabs, Drive upload, HeyGen — has an error handler attached. If any of those fail, the error handler writes Status to 'Error' and puts the error message in the Error Message column.
>
> Rows never get stuck in a half-state."

### Scene 6 — Wrap (20 sec)
> "Next video: the daily operator flow. How you actually use this day to day."

---

## LOOM 3 — Daily Operator Flow (2-3 min)

**Open with:** Google Sheet, Queue tab visible.

### Scene 1 — Add a row (45 sec)
> "Daily operation. To produce a new video, you fill in one row in the Queue tab.
>
> Required fields: Status, Script ID, Script Name, Variation Number, Avatar ID, Voice ID, Audience, Current Belief, Desired Belief, Tone, Emotional Arc, Offer/CTA, Script Text. That's it.
>
> If you want to override the global defaults — different voice for one row, different avatar, different ElevenLabs settings — you fill in the Override column for that row only. Otherwise the system uses the defaults from the System Settings tab.
>
> Set Status to 'Queued' and you're done."

### Scene 2 — What happens next (45 sec)
> "Within 15 minutes, the V1 scenario picks the row up. Status flips to 'Processing', then 'Script Done', then 'Voice Done', then 'Rendering'.
>
> The Script Doc Link, Brief Doc Link, Voice File URL, and Render Job ID columns fill in along the way.
>
> The render takes between 5 and 15 minutes on HeyGen's side. When it finishes, Status flips to 'Done' and the Raw Video Link populates."

### Scene 3 — Editor handoff (30 sec)
> "Manually flip Status to 'Ready for Editing' when you're handing off, and assign an editor in the Assigned Editor column.
>
> The editor downloads the Brief Doc, the Voice File, and the Raw Video. They edit in their tool. They put the final URL in Edited Video Link and update QA Status.
>
> The system doesn't automate the editing side — that's intentional, per your spec."

### Scene 4 — When something fails (30 sec)
> "If you see Status = 'Error' on a row, check the Error Message column. The message tells you which module failed and why. Common causes are documented in the Troubleshooting Guide in the 10_Documentation folder.
>
> Most fixes are: re-set Status to 'Queued' and the row will reprocess on the next run."

### Scene 5 — Wrap (15 sec)
> "That's the daily flow. Sheet-driven, no Make.com knowledge required.
>
> Documentation has more detail. Reach out if anything's unclear."

---

## Recording Tips

- Use Loom desktop app for cleaner audio than browser
- Show your face in the corner for the first 10 seconds of each video, then optional
- Don't re-record for small mistakes — Erika cares about the system, not perfect delivery
- If a take feels wrong after 30 seconds in, restart. Easier than editing.
- Total recording time should be under 30 minutes including retries

## Upload destination

Loom links go in the Upwork delivery message (template in `delivery_message.md`).
