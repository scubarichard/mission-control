# Chosen Agency V1 — Synthetic Handoff Video Script

**Purpose:** Polished walkthrough video to deliver to Erika upon V1 handoff.
**Approach:** Generate via the V1 pipeline itself (eat our own dog food).
**Avatar:** Tyler (or whichever is on Erika's HeyGen account)
**Voice:** Richard's HeyGen-linked voice (or Erika's preferred voice at handoff)
**Estimated render time:** 5-7 minutes finished video
**Pacing:** SSML break tags inline

---

## Script Text (with SSML break tags)

Hi Erika — welcome to your Content Pipeline V1.
<break time="0.6s"/>

This is the system you commissioned. Now it's running. Here's how to use it.
<break time="1.0s"/>

Everything starts in the Queue tab of your Content_Pipeline sheet.
<break time="0.4s"/>
Drop a new row with your audience, your belief shift, and your call to action.
<break time="0.4s"/>
Set Status to Queued.
<break time="0.5s"/>
That's all you do.
<break time="0.8s"/>

Within 15 minutes, the system writes you four things.
<break time="0.4s"/>
A complete script with natural pacing.
<break time="0.4s"/>
A social caption ready to post.
<break time="0.4s"/>
An editor brief covering pacing, B-roll cues, music, and captions.
<break time="0.4s"/>
And a finished avatar video — voiceover synthesized, lip-synced, broadcast-quality.
<break time="0.8s"/>

Each row's Status column shows where it is in the pipeline.
<break time="0.4s"/>
Queued, Processing, Script Done, Rendering, Done.
<break time="0.6s"/>
When it hits Done, click the Raw Video Link and you have a ready-to-edit video.
<break time="1.0s"/>

You also have override columns.
<break time="0.4s"/>
Want a different voice for one row? Use Override Voice ID.
<break time="0.4s"/>
Different avatar? Override Avatar ID.
<break time="0.4s"/>
Different tone or voice settings? Same idea.
<break time="0.4s"/>
Leave them blank to use system defaults.
<break time="0.8s"/>

Behind the scenes there's a Render Checker scenario running every five minutes.
<break time="0.4s"/>
If a render takes longer than expected, it picks up the slack — flips Status to Done when HeyGen finishes, or Failed if something went wrong.
<break time="0.4s"/>
You don't manage it. It just works.
<break time="1.0s"/>

You have four documentation files in your Drive folder.
<break time="0.4s"/>
The Operator SOP — your day-to-day playbook.
<break time="0.4s"/>
The Field Map — what every column means and how data flows.
<break time="0.4s"/>
The Credential Map — your API keys and how to rotate them.
<break time="0.4s"/>
And a Troubleshooting Guide — ten sections covering the most common issues.
<break time="0.8s"/>

A few notes about Phase 2 enhancements.
<break time="0.4s"/>
Higgsfield integration — deferred unless you want it as a paid add-on.
<break time="0.4s"/>
Notion sync — same.
<break time="0.4s"/>
And a webhook conversion that would replace inline polling with HeyGen callbacks — useful when your volume scales above fifty videos a week.
<break time="0.8s"/>

That's V1.
<break time="0.6s"/>
Drop your first real row in the queue.
<break time="0.4s"/>
Watch it produce.
<break time="0.4s"/>
Let me know what you think.
<break time="1.0s"/>

If anything goes sideways, the Troubleshooting Guide covers the most common patterns.
<break time="0.4s"/>
Beyond that, message me directly.
<break time="0.6s"/>

Thanks for trusting 1AltX with this build. Let's ship some content.

---

## Caption (for social if needed)

Just shipped a custom Content Pipeline V1 build for @ChosenAgency — Sheets-based queue feeding OpenAI for scriptwriting, ElevenLabs and HeyGen for synthesis, with a Render Checker safety net. The whole stack runs autonomously. #AIautomation #ContentMarketing #1AltX

---

## How to Generate This Video

When ready (V1 scenario fully working in Erika's account):

1. **Add a row to her Content_Pipeline sheet:**
   - Status: `Queued`
   - Script ID: `HANDOFF-VIDEO`
   - Script Name: `Chosen Agency V1 Handoff Walkthrough`
   - Variation Number: `1`
   - Audience: `Erika Cobb (Chosen Agency owner) and her team`
   - Current Belief: `unfamiliar with the new system`
   - Desired Belief: `confident operating the system, knows where to find help`
   - Tone: `confident, warm, professional`
   - Emotional Arc: `curious → guided → confident`
   - Offer / CTA: `Drop your first real row in the queue and let me know what you think`

2. **Override the script generation** (since this is special — pre-written):
   - Paste the script text above directly into the Script Text column
   - Skip Module 5 (script generation) — would need a manual workflow OR
   - Better: have OpenAI generate the script using the script above as the entire user prompt

3. **Run the pipeline:** click Run Once
4. **Wait ~5-10 minutes** for video to render
5. **Download:** click Raw Video Link
6. **Upload to Drive:** put it in Erika's `05_Final_Videos` folder
7. **Send to Erika:** Slack message with the Drive link

## Alternative: direct API generation

If we want to bypass the V1 pipeline (faster, doesn't depend on her sheet being set up):

```powershell
$heygenKey = "<key>"
$payload = @{
    video_inputs = @(@{
        character = @{
            type = "avatar"
            avatar_id = "Tyler-incasualsuit-20220721"
            avatar_style = "normal"
        }
        voice = @{
            type = "text"
            input_text = "<script above with break tags>"
            voice_id = "a9c42ba3dd4b441eac3fb3221c6fcf59"
        }
    })
    dimension = @{ width = 1920; height = 1080 }
}
Invoke-RestMethod -Uri "https://api.heygen.com/v2/video/generate" -Method POST `
    -Headers @{"X-Api-Key"=$heygenKey;"Content-Type"="application/json"} `
    -Body ($payload | ConvertTo-Json -Depth 10 -Compress)
```

Then poll for completion (typically 60-90 seconds) and download.

---

## Word Count + Estimated Duration

- Word count: ~340 words
- Estimated speaking duration: ~2.5-3 minutes
- With pauses: ~3.5-4 minutes
- Final video file size: ~10-15 MB at 1920×1080

This sits in the sweet spot for handoff videos — long enough to convey the system clearly, short enough to actually watch.

---

## Style Notes

- Tone is confident but not hype-y
- Acknowledges Phase 2 deferred items so Erika knows what's possible later (door open for follow-on work)
- Closes warm — "thanks for trusting 1AltX" without being saccharine
- CTA leads to action ("drop your first real row") not vague pleasantries
