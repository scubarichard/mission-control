# Chosen Agency — Content Pipeline V1
## Video Walkthrough Script

**Estimated runtime:** 7–9 minutes
**Format:** Screen capture + narration. Avatar intro/outro optional.
**Audience:** Erika Cobb and her ops team. Assumes general familiarity with content production but not with Make.com or APIs.

---

## SECTION 1 — INTRODUCTION (~45 sec)

**[Scene: Title card or avatar intro]**

> Welcome. This is a walkthrough of the Content Pipeline that turns a single brief into a finished avatar video — automatically, in about ten minutes. By the end of this video, you'll know how to submit briefs, how the system processes them behind the scenes, how to add new avatars and voices, and what to do if something goes wrong.

> The pipeline has five moving parts, but you only ever interact with two of them: a web form and a Google Sheet. Everything else runs on its own.

---

## SECTION 2 — THE FORM (~75 sec)

**[Scene: Open the intake form in a browser]**

> Here's the intake form. This is where every brief starts.

> The form is divided into four sections. **Identity** captures the name and version of your script. **Talent** is where you pick the avatar and voice. **Audience and Belief Shift** is the strategic core — who's watching, what they currently believe, and what you want them to believe after. And **Style, Arc, and Offer** locks in the tone and the call to action.

**[Scene: Click into the Talent section]**

> The avatar gallery is loaded directly from HeyGen. Each card shows the actual preview image. If you don't see an avatar you want, choose Custom ID and paste any HeyGen avatar ID — including talking photos you've created yourself.

**[Scene: Fill out a sample brief end-to-end]**

> Let's submit one. I'll pick Tyler as the avatar, the default voice, and fill in a quick brief about content repurposing for marketing agencies. Hit submit.

**[Scene: Show the success message]**

> Done. The form gives me a Script ID. The pipeline is now running in the background. The actual video will arrive in five to fifteen minutes.

---

## SECTION 3 — WHAT HAPPENS BEHIND THE SCENES (~2 min)

**[Scene: Architecture diagram]**

> Here's what actually happens in those ten minutes. Five Make.com scenarios cooperate to take your brief from text to finished video.

**[Scene: Highlight Scenario 1 - Intake Form Receiver]**

> **Step one. Intake Form Receiver.** When you hit submit, this scenario receives the JSON, writes a new row to the Queue tab in Google Sheets, and immediately fires the main pipeline. This whole step takes about half a second.

**[Scene: Highlight Scenario 2 - Content Pipeline V1]**

> **Step two. Content Pipeline V1.** This is where the real work happens. It pulls your brief from the sheet, then calls GPT-4o to write a video script in your specified tone. Then it calls GPT-4o again to generate a detailed brief for your video editor — what visuals to add, what B-roll to find, what risks to watch for. Both get saved as Google Docs.

> Then it calls ElevenLabs to generate the voice audio file using the voice you selected. The MP3 gets uploaded to Google Drive and linked in the sheet.

> Finally, it submits the script and voice to HeyGen for video rendering. HeyGen returns a job ID, and the pipeline writes "Rendering" in the Status column. At this point the pipeline is done — it doesn't sit and wait.

**[Scene: Highlight Scenario 3 - HeyGen Webhook Receiver]**

> **Step three. HeyGen Webhook Receiver.** HeyGen takes five to fifteen minutes to render the video. When it's done, HeyGen sends a callback to this scenario. The scenario finds your row using the row number we passed earlier, and writes the final video URL into the Raw Video Link column. Status flips from Rendering to Done.

**[Scene: Highlight Scenario 4 - Render Checker]**

> **Step four. Render Checker.** This is a safety net. It runs every five minutes and looks for any row that's been Rendering too long. If it finds one, it asks HeyGen directly for the status — just in case the callback got lost. This belt-and-suspenders setup means a single dropped network packet doesn't strand your video forever.

**[Scene: Highlight Scenario 5 - Avatar Lister]**

> **Step five. Avatar Lister.** This is the only scenario you don't really see. It runs in the background to feed the form's avatar gallery — pulling the latest list of avatars from HeyGen so you always have the current options.

---

## SECTION 4 — THE GOOGLE SHEET (~1.5 min)

**[Scene: Open the Google Sheet, show the Queue tab]**

> Here's the Queue tab. Each row is a video. The Status column tells you where it is in the pipeline — from Queued, to Processing, to Script Done, to Voice Done, to Rendering, to Done.

> When a row reaches Done, the Raw Video Link column has the HeyGen download URL. The Script Doc Link and Brief Doc Link columns have the Google Docs your editor needs.

**[Scene: Click on the Avatars tab]**

> This is the Avatars tab. This is your control panel for which avatars show up in the form. To add a new avatar, paste a new row with the HeyGen avatar ID, give it a display name and a description, set Active to TRUE, and pick a sort order. Refresh the form. Done.

> To temporarily hide an avatar — say, you want to retire one without losing the configuration — just flip Active to FALSE. It disappears from the form on next load.

**[Scene: Click on the Voices tab]**

> Same pattern for voices. Paste an ElevenLabs voice ID, name it, mark it Active, refresh the form.

> No code changes needed for either of these. Anyone with edit access to this sheet can curate the form.

---

## SECTION 5 — DAY-TO-DAY OPERATION (~1 min)

**[Scene: Submit another brief at fast pace]**

> Day-to-day, the rhythm is simple. Open the form, submit a brief, wait ten minutes, grab the video link from the sheet.

> If you want to batch a whole content calendar, you can submit ten briefs in a row. The pipeline handles up to five concurrent jobs through HeyGen, so a ten-brief batch typically clears in twenty to thirty minutes.

> Editors work from the Brief Doc and Voice File. They don't need to see the form or the pipeline at all — they just open the sheet, find a row marked Done, and click into the linked Google Docs.

---

## SECTION 6 — TROUBLESHOOTING (~75 sec)

**[Scene: Show the Make execution history]**

> If something goes wrong, here's where to look. Open Make.com, navigate to the Chosen Agency folder. Click into whichever scenario is showing red. The execution history shows you exactly which module failed and why.

> The most common issues are: a row stuck at Processing, which usually means OpenAI or ElevenLabs hit a rate limit. A row stuck at Rendering for more than half an hour, which means the Render Checker should catch it within five minutes. And the form showing success but nothing landing in the sheet, which means the Intake scenario is paused — toggle it back on.

> If a video genuinely fails to render, HeyGen sends an Error status, and the Error Message column tells you why. Common causes are scripts over the character limit or invalid avatar IDs.

---

## SECTION 7 — CLOSING (~30 sec)

**[Scene: Show finished video as a result of the demo brief]**

> That's the whole pipeline. Five scenarios, one form, one sheet. Ten minutes from idea to finished video.

> All the technical details — every webhook URL, every connection ID, every column — are in the Technical Walkthrough document that comes with this video. Anything that needs human judgment lives in the form or the sheet, where you control it directly.

> If you have questions, reach out to Richard at one-alt-x. Otherwise — happy producing.

**[Scene: Outro / CTA card]**

---

## NARRATION NOTES FOR THE AGENT

- **Tone:** Confident, competent, non-condescending. The viewer is a content professional, not a developer.
- **Pace:** Steady. Don't rush the technical sections. Let the screen catch up to the narration on workflow demos.
- **B-roll suggestions:**
  - Section 2: form being filled out, real-time, no fast-forward
  - Section 3: each scenario highlighted in turn, with arrows showing data flow
  - Section 4: zoom into the Avatars tab, then the Voices tab, with brief edit demonstrated
  - Section 5: split screen showing 3 briefs being submitted vs. the rows appearing in the sheet
- **Avatar intro/outro:** Optional. If used, keep under 10 sec. The product walkthrough is the value.
- **Captions:** Recommended throughout. Use the Caption Text column from a real generated row as a model for caption style.

---

## TIMING SUMMARY

| Section | Duration |
|---|---|
| 1. Introduction | ~45 sec |
| 2. The Form | ~75 sec |
| 3. Behind the Scenes | ~2 min |
| 4. The Google Sheet | ~90 sec |
| 5. Day-to-Day Operation | ~60 sec |
| 6. Troubleshooting | ~75 sec |
| 7. Closing | ~30 sec |
| **Total** | **~8 min 15 sec** |

---

*Pair this script with the TECHNICAL_WALKTHROUGH.md document for full reference material. The script tells the story; the doc has the receipts.*
