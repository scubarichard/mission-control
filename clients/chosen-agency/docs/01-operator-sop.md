# Chosen Agency Content Pipeline V1 — Operator SOP

**Version:** 1.0  
**Last Updated:** 2026-05-04  
**Owner:** Erika Cobb (Chosen Agency)  
**Builder:** Richard Mabbun (1AltX)

## What This System Does

The pipeline takes a content brief (audience, belief shift, tone, CTA) from a Google Sheet row and automatically produces:

1. A 60-90 second video script (with natural pacing breaks)
2. A social media caption
3. An editable Google Doc of the script
4. An editor brief Google Doc (pacing, B-roll cues, music tone, captions)
5. A finished avatar video with synthesized voiceover

End-to-end run time: 5-15 minutes per row.

---

## Day-to-Day Operation

### Adding a New Content Brief

1. Open the **Content_Pipeline** Google Sheet
2. Go to the **Queue** tab
3. Add a new row at the bottom with these columns filled:
   - **Status:** `Queued`
   - **Script ID:** unique identifier (e.g., `BLOG-2026-05-15`)
   - **Script Name:** descriptive title
   - **Variation Number:** `1` (or higher if A/B testing)
   - **Audience:** target persona description
   - **Current Belief:** what the audience currently thinks
   - **Desired Belief:** what you want them to think after watching
   - **Tone:** e.g., "confident, conversational"
   - **Emotional Arc:** e.g., "skeptical → curious → convinced"
   - **Offer / CTA:** what action to drive

That's it. The pipeline picks up the row automatically within 15 minutes (or fire it manually — see below).

### Manual Trigger (Run Once)

Most days, the pipeline runs on schedule. To force a run:

1. Open the V1 Make scenario
2. Click **Run once** in the bottom toolbar
3. Watch the modules turn green left-to-right

### What "Done" Looks Like

When a row's Status flips to `Done`, the row will have:

- ✅ Script Doc Link populated
- ✅ Brief Doc Link populated
- ✅ Raw Video Link populated (HeyGen URL)
- ✅ Last Updated timestamp

Click the Script Doc Link to review and edit copy. Click Raw Video Link to download the avatar video.

---

## Status Values You'll See

| Status | What It Means | Action Needed |
|---|---|---|
| `Queued` | Row is waiting to be picked up | None — wait |
| `Processing` | OpenAI generating script | None — wait |
| `Script Done` | Script + brief docs written | None — wait |
| `Voice Done` | (Legacy — no longer used in V1.5) | Ignore |
| `Rendering` | HeyGen creating video | Wait 5-30 minutes |
| `Done` | All artifacts ready | Review docs + video |
| `Failed` | Something broke | See Troubleshooting Guide |
| `Error` | Render Checker found a stuck row | See Troubleshooting Guide |

---

## Override Columns (Advanced)

Each row supports optional overrides. Leave blank to use system defaults.

| Override Column | What It Does |
|---|---|
| **Override Voice ID** | Use a different ElevenLabs voice for this row only |
| **Override Avatar ID** | Use a different HeyGen avatar for this row only |
| **Override Tone** | Override the script tone without changing the row's Tone field |
| **Override ElevenLabs Stability** | 0.0-1.0; lower = more expressive (default 0.5) |
| **Override ElevenLabs Similarity Boost** | 0.0-1.0; higher = closer to source voice (default 0.75) |

**Common use cases:**
- Test a new voice on one row before changing system default
- Use a different avatar for a specific persona
- Adjust voice expression for emotional content

---

## Editor Workflow

When a row hits `Done`:

1. Open the **Editor Brief Doc** (Brief Doc Link column)
2. Read the brief — it covers:
   - Pacing & cut rhythm
   - B-roll style suggestions
   - Music tone & volume
   - Text overlays & captions
   - Transitions
3. Open the **Script Doc** (Script Doc Link column) for the actual narration text
4. Open the **Raw Video Link** to download the HeyGen avatar render
5. Hand off video file + briefs to your editor

---

## When Things Look Wrong

**Status stuck at `Rendering` for >30 minutes:**
- The Render Checker scenario will pick it up within 5 minutes and either flip to `Done` or `Error`
- If still stuck after an hour, see Troubleshooting Guide

**Status flipped to `Failed`:**
- Check the **Error Message** column for details
- Common causes covered in Troubleshooting Guide

**Doc Links are empty:**
- The pipeline failed before doc creation
- Check Make scenario history for the failed run
- See Troubleshooting Guide

---

## Where Things Live

- **Production sheet:** Content_Pipeline (Queue tab)
- **Make scenarios:** V1 Production + Render Checker (in 1AltX team)
- **Drive folders:** 02_Script_Docs (script docs), 03_Editor_Briefs (briefs), 04_Voiceover (audio - V1 only)
- **System Settings tab:** in the same Sheet, contains default values

---

## Daily Checklist (Optional)

- [ ] New rows added with status `Queued`
- [ ] Yesterday's rows show `Done` with all 4 outputs
- [ ] No rows stuck in `Rendering` >30 min
- [ ] No rows in `Failed` status (or all reviewed and re-queued)

---

## Need Help?

1. First check the Troubleshooting Guide
2. If stuck, message Richard at richard@1altx.com or in Slack
