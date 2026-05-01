# Chosen Agency — Content Pipeline V1 Operator SOP

**System:** Chosen Agency Content Machine — AI Avatar Video Pipeline  
**Audience:** Erika Cobb and her editor team (non-technical operators)  
**Last Updated:** 2026-05-01  

---

## 1. What This System Does

The Content Machine is an automated pipeline that takes a single row of content inputs and produces a complete, editor-ready AI avatar video package — no technical knowledge required to operate it.

Here's what happens automatically after you queue a row:

1. **Script generation** — If you didn't write a script, the system writes one based on your topic, audience, tone, and goals using GPT-4o.
2. **Editor Brief creation** — A detailed 4-section editing brief is generated alongside the script, telling your video editor exactly how to edit for maximum impact.
3. **Audio generation** — The script is turned into a professional voiceover using ElevenLabs with your chosen voice settings.
4. **Video generation** — A HeyGen AI avatar video is generated using the audio and your chosen avatar.
5. **Status tracking** — Every step updates the Production Tracker sheet automatically. You always know where each piece of content is in the pipeline.

When the system finishes, the row's status changes to **Ready for Editing** and your editor can begin. Everything before that step is fully automated. Everything after is human work.

---

## 2. Daily Workflow

### Step 1: Open the Production Tracker

Go to the **Content_Pipeline_V1** Google Sheet. The main tab you'll work in is called **Queue**.

### Step 2: Add a New Row

Click the first empty row below existing content and fill in these fields:

| Field | Required? | What to enter |
|---|---|---|
| **Status** | Yes | Type `Queued` exactly — this starts the pipeline |
| **Script ID** | Yes | A short unique code for this script (e.g. `SLEEP-001`, `BRAND-003`) |
| **Script Name** | Yes | Human-readable name (e.g. `Sleep Tips for Busy Professionals`) |
| **Variation Number** | Yes | Usually `1`. If you're making a second version of the same script, use `2` |
| **Audience** | Yes | Who this video is for (e.g. `working professionals aged 30-50 struggling with sleep`) |
| **Current Belief** | Yes | What your audience believes right now that's holding them back |
| **Desired Belief** | Yes | What you want them to believe after watching |
| **Tone** | Yes | e.g. `bold, direct` or `warm, conversational` |
| **Emotional Arc** | Yes | e.g. `frustrated → hopeful` |
| **Offer / CTA** | Recommended | What action you want the viewer to take |
| **Script Text** | Optional | Leave blank to let AI generate. Fill in if you already wrote the script. |
| **Caption Text** | Optional | Leave blank or add your own caption |

**Override columns** (columns P–T): Leave these blank unless you want to use different voice or avatar settings for this specific row. See Section 4 (Override Settings) for details.

### Step 3: Wait for Processing

Once you set Status to `Queued`, the system picks it up automatically within 15 minutes. You'll see the status column change as it progresses:

| Status | Meaning |
|---|---|
| `Queued` | Waiting to be picked up |
| `Processing` | Pipeline started — OpenAI running |
| `Script Done` | Script and Editor Brief generated, Docs created |
| `Voice Done` | ElevenLabs audio generated |
| `Rendering` | HeyGen video submitted, waiting for render (2–10 min) |
| `Done` | Everything complete — video ready for editor |
| `Error` | Something went wrong — check the Error Message column |

### Step 4: Confirm Outputs

When status reaches **Done**, verify these columns are filled:

- **Script Doc Link** — Google Doc with the generated script
- **Brief Doc Link** — Google Doc with the editor brief
- **Voice File URL** — ElevenLabs audio file (Google Drive link)
- **Raw Video Link** — HeyGen AI avatar video

### Step 5: Assign to Editor

Fill in **Assigned Editor** with the editor's name and notify them. The status will move to `Editing` once they start.

---

## 3. Status Meanings and What to Do

| Status | What it means | What you do |
|---|---|---|
| `Queued` | Row is waiting for the next pipeline run | Nothing — wait |
| `Processing` | Pipeline is running | Nothing — wait |
| `Script Done` | Scripts and Docs are ready | Check Script Doc and Brief Doc links look valid |
| `Voice Done` | Audio generated | Nothing — pipeline continues automatically |
| `Rendering` | Waiting on HeyGen video render | Wait up to 10 min. The Render Checker runs every 5 min and updates status. |
| `Done` | Video package complete | Assign to editor |
| `Error` | A step failed | Read the Error Message column. See Section 5 (Troubleshooting). |
| `Editing` | Editor is working on it | Check in with editor |
| `Ready for QA` | Editor is done | Review the edited video |
| `Done` (final) | QA passed, ready to publish | Schedule or publish |

---

## 4. Override Settings (Advanced)

The system has global defaults for voice, avatar, and quality settings. You can override these for any individual row using the Override columns (P–T).

| Override Column | What it changes | Example value |
|---|---|---|
| **Override Voice ID** (col P) | Which ElevenLabs voice is used | `IuxDTLynYdvisya7jrK5` |
| **Override Avatar ID** (col Q) | Which HeyGen avatar is used | `Adrian_public_3_20240312` |
| **Override Tone** (col R) | Overrides the Tone field for the OpenAI prompt | `casual, friendly` |
| **Override ElevenLabs Stability** (col S) | Voice stability (0.0–1.0) | `0.4` |
| **Override ElevenLabs Similarity Boost** (col T) | Voice similarity (0.0–1.0) | `0.75` |

**When to use overrides:** Only when a specific piece of content needs different settings than your defaults. For 95% of content, leave all override columns blank.

**Global defaults** are stored in the **System Settings** tab of the same sheet. Your builder or system admin updates defaults there — do not edit System Settings unless instructed.

---

## 5. Where Outputs Go

| Output | Location |
|---|---|
| Script Documents | Google Drive → Chosen Agency → `02_Script_Docs` |
| Editor Briefs | Google Drive → Chosen Agency → `03_Editor_Briefs` |
| Audio Files | Google Drive → Chosen Agency → `05_ElevenLabs_Audio` |
| Raw Videos | Google Drive → Chosen Agency → `04_Raw_AI_Videos` (linked via HeyGen) |
| All links | Also written back to the Production Tracker sheet row |

The Production Tracker is always your source of truth. Every output link is recorded in the row.

---

## 6. What to Do When Something Breaks

### Quick Recovery (3 steps):

1. **Check the Status column** — Is it `Error`? That means a step failed.
2. **Check the Error Message column** (column AA) — This tells you which step failed and why.
3. **Fix the problem, reset Status to `Queued`** — The pipeline will re-run from the start.

### Common errors and fixes:

| Error Message | Likely Cause | What to Do |
|---|---|---|
| `OpenAI: ...` | AI generation failed | Check that the row has Audience, Tone, and content fields filled. Reset to Queued. |
| `ElevenLabs: 401` | Voice API key issue | Contact your system admin — the ElevenLabs key may need rotation. |
| `ElevenLabs: 404` | Voice ID not found | Check the Voice ID in System Settings or your Override Voice ID field. |
| `HeyGen: 401` | Video API key issue | Contact your system admin. |
| `Rendering` (stuck) | HeyGen render taking longer than expected | Wait 15 min. If still stuck, run the Render Checker scenario manually in Make.com. |
| Row stuck at any status | Pipeline interrupted | Reset Status to `Queued` and it will re-run. |

### If you're not sure:
- Check that the row has all Required fields filled (see Step 2 table above)
- Make sure Status is spelled exactly right (`Queued`, `Done`, etc.)
- Do NOT manually edit any system columns (Script Doc Link, Voice File URL, Render Job ID, etc.) — the pipeline manages these

---

## 7. What NOT to Do

- **Do NOT manually change Status to anything other than `Queued` or `Error`** (setting it back to Queued retries the row) — other statuses are set by the automation
- **Do NOT delete rows from the Queue tab** — archive them by moving to Done or by adding a note in Error Message
- **Do NOT edit or delete rows in System Settings** unless instructed by your system admin
- **Do NOT run Make.com scenarios manually** unless troubleshooting a stuck Rendering row
- **Do NOT add new columns** to the Queue tab — the column order is locked. Add notes in Assigned Editor or Caption Text
- **Do NOT share the Google Sheet publicly** — it contains API credentials in System Settings

---

## 8. Getting Help

If something isn't working and you've tried the quick recovery steps:
- Contact **Richard Mabbun** (richard@1altx.com) — your system builder
- Share a screenshot of the row (Status + Error Message columns)
- Note the Script ID and which step it's stuck on

---

*This SOP covers V1 of the Chosen Agency Content Machine. Loom video walkthroughs are available separately.*
