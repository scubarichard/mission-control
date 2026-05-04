# Chosen Agency Content Pipeline V1 — Troubleshooting Guide

**Version:** 1.0  
**Last Updated:** 2026-05-04

When something looks wrong, work through this guide top to bottom. Most issues fall into one of the patterns below.

---

## Quick Diagnostic Flow

```
Start → What's the row's Status?
  ├─ Queued — Wait, OR scenario is paused (check Make scenario state)
  ├─ Processing — Check OpenAI, see Section A
  ├─ Script Done — Check HeyGen, see Section B
  ├─ Rendering — Check polling, see Section C
  ├─ Failed — Read Error Message column, see Section D
  ├─ Error — Render Checker found stuck row, see Section E
  └─ Done — All good, no action needed
```

---

## Section A: Stuck at "Processing"

**Symptom:** Row sits at `Processing` for >2 minutes without advancing to `Script Done`.

### A1. Check OpenAI quota/billing

- Go to https://platform.openai.com/usage
- Verify account has credit and isn't rate-limited
- If empty: top up the account, re-run the row

### A2. Check Make scenario history

- Open the V1 scenario in Make
- Click History (clock icon, bottom toolbar)
- Find the most recent run
- Look for red error indicators on Module 5 or Module 23
- Click the error to read details

### A3. Common Module 5/23 errors

| Error | Cause | Fix |
|---|---|---|
| `429 Rate limit` | Too many requests | Wait 60 sec, re-run |
| `401 Unauthorized` | API key invalid/rotated | Update OpenAI connection in Make |
| `Token quota exceeded` | Account out of credit | Add credit at platform.openai.com |
| `JSON decode error` | OpenAI returned malformed JSON | Re-run; if persistent, prompt may need adjustment |

### A4. Manual recovery

If the row is stuck and you don't want to debug:
1. Delete that row
2. Re-add a fresh row with `Queued` status
3. The pipeline will pick it up

---

## Section B: Stuck at "Script Done"

**Symptom:** Row has Doc Links populated but doesn't advance to `Rendering`.

### B1. Check HeyGen quota

- Open https://app.heygen.com → Account → Subscription
- Verify account has video credits remaining
- If 0: upgrade plan or wait for monthly reset

### B2. Check Module 10 in Make history

- Find the most recent failed run
- Click Module 10 (HeyGen Create video)
- Look at the OUTPUT or ERROR
- Common errors:
  - `401 Unauthorized` — HeyGen API key invalid; rotate
  - `Avatar not found` — Avatar ID doesn't exist on this HeyGen plan; switch avatar
  - `Voice not found` — Voice ID doesn't exist on this HeyGen plan; switch voice
  - `Insufficient credits` — Top up HeyGen plan

### B3. Manual recovery

1. Set Status back to `Queued`
2. Clear Render Job ID and Raw Video Link columns
3. Re-run the scenario manually

---

## Section C: Stuck at "Rendering"

**Symptom:** Row has been at `Rendering` for >30 minutes.

### C1. The Render Checker should handle this automatically

- The Render Checker scenario runs every 5 minutes
- It scans rows with Status = `Rendering`
- If HeyGen reports the video as `completed`, it flips Status to `Done`
- If HeyGen reports `failed`, it flips Status to `Failed`

### C2. Verify Render Checker is active

- Go to Make → scenarios list
- Find "Chosen Agency - Render Checker"
- Confirm toggle is ON (active)
- If OFF: turn it on, wait 5 min for next run

### C3. Manual check via HeyGen API

If you want to check immediately:
1. Copy the Render Job ID from the row
2. Go to HeyGen dashboard → Videos
3. Search by ID — if it shows complete with a downloadable URL, copy that URL
4. Manually paste URL into Raw Video Link column
5. Set Status = `Done`

### C4. Long renders (genuinely >40 min)

Some renders take longer than the 40-iteration polling window in V1 scenario. Render Checker is the safety net for this. If even the Render Checker doesn't pick it up after 1 hour:
- HeyGen may have failed silently
- Check HeyGen dashboard for the actual job
- If failed: re-queue the row

---

## Section D: Status = "Failed"

**Symptom:** Status is `Failed`, Error Message column populated.

### D1. Read the Error Message

Common patterns:

**`HeyGen render failed: <reason>`**
- HeyGen rejected the video
- Reasons: avatar inappropriate, voice issue, content policy violation
- Action: review the script for problematic content; adjust and re-queue

**`HeyGen render failed: timeout`**
- HeyGen took too long internally
- Action: re-queue the row; usually transient

**`Avatar not available on plan`**
- The Avatar ID isn't licensed on this HeyGen plan
- Action: either upgrade plan OR change to a default avatar

### D2. Recovery flow

1. Read error
2. Fix root cause if possible (script, settings, plan)
3. Reset row Status to `Queued`
4. Clear Error Message
5. Re-run

---

## Section E: Status = "Error"

**Symptom:** Status is `Error`, set by the Render Checker.

This usually means: the Render Checker couldn't reach HeyGen or got an unexpected response when checking on a `Rendering` row.

### E1. Check Render Checker history

- Open Render Checker scenario in Make
- View history → most recent run
- Check for HTTP errors

### E2. Common causes

- HeyGen API outage (check https://status.heygen.com)
- HeyGen API key rotated
- Network/firewall issue at Make's end

### E3. Recovery

- Wait 15 minutes; transient issues resolve themselves
- Reset the row Status to `Rendering` (or `Queued` if you want to redo from scratch)
- Re-run as needed

---

## Section F: All output columns are empty after a "successful" run

**Symptom:** Status is `Done` but Doc Links, Raw Video Link, etc. are blank.

### F1. Check for column-name mismatch

- This was a bug in early V1 builds where Make wrote to wrong columns
- Open Module 6, 11, 16 in Make
- Verify the "Values" mapping uses the correct V1 column names: `Status`, `Script Doc Link`, `Brief Doc Link`, `Raw Video Link`, etc.
- If wrong: fix mapping, save, re-run

### F2. Check for empty references

- Module 6 references `{{24.webViewLink}}` for Script Doc Link
- If Module 24 didn't actually create a doc, the reference is empty
- Check Module 24 history for errors

---

## Section G: Doc URLs are present but broken (404)

**Symptom:** Click on Script Doc Link → "You need access" or 404.

### G1. Permission issue

- The doc was created but Erika's account doesn't have access
- Action: open the doc as the creator (richard@1altx.com), share with Erika

### G2. Doc was deleted

- Someone (or another scenario) deleted the doc
- Action: re-run the row to recreate

---

## Section H: Pacing is flat / no pauses in audio

**Symptom:** Avatar talks in a run-on monotone with no natural pauses.

### H1. Verify SSML break tags are in the script

- Open the Script Doc
- Look for `<break time="0.4s"/>` or similar tags
- If absent: Module 5's prompt may have been changed or OpenAI ignored instructions
- Action: check Module 5 system prompt contains pacing instructions

### H2. Verify HeyGen is in text mode (not audio mode)

- Open Module 10 in Make
- Body should have `"voice": { "type": "text", "input_text": "...", "voice_id": "..." }`
- If body has `"voice": { "type": "audio", "audio_url": "..." }`: that's the V1 (legacy) ElevenLabs-direct architecture which silently strips SSML
- Action: switch to text mode

### H3. Voice ID issue

- The `voice_id` in Module 10 must be one that HeyGen recognizes
- Default: `a9c42ba3dd4b441eac3fb3221c6fcf59` (Richard's linked voice)
- If using a HeyGen native voice, ensure it's accessible on the plan

---

## Section I: Make scenario shows "scenario rejected: scenario is running"

**Symptom:** Click Run Once → red error "Scenario was rejected: Scenario is running"

### I1. Phantom lock

- Make's UI sometimes thinks a run is in progress when it isn't
- Action 1: refresh the page (Ctrl+Shift+R)
- Action 2: Open History panel, look for any "Running" entries, manually stop them
- Action 3: Wait 5-15 minutes for Make's session lock to expire
- Action 4: Sign out of Make and back in

### I2. Real concurrent run

- Another instance of the scenario is actually running
- Wait for it to finish (check History)
- Then run again

---

## Section J: Render Checker not picking up stuck rows

**Symptom:** Row has been `Rendering` for an hour; Render Checker is active but not flipping it.

### J1. Verify Render Checker is targeting the right sheet

- Open Render Checker scenario
- Module 1 (filter rows): should target the V1 Sheet ID and the `Queue` tab
- Filter should be Status = `Rendering`

### J2. Verify HeyGen API connection

- Module 2 in Render Checker (HeyGen check status)
- Should use the same X-Api-Key as V1 scenario Module 14
- If keys differ, sync them

### J3. Manual run

- Run the Render Checker scenario manually once
- Check its history
- See if it found the stuck row and what HeyGen returned

---

## When to Escalate

Reach out to Richard (richard@1altx.com or Slack) if:

- A bug persists after trying the recovery steps above
- A new failure pattern not covered in this guide
- Suspected security issue (e.g., unauthorized scenario edits)
- Need an architectural change

Include in your message:
- Row's Script ID
- Status and Error Message
- Make scenario history link to the failed run (right-click run → copy link)
- What you've already tried

---

## Glossary

- **Bundle:** One unit of data flowing through Make modules
- **Operation:** One action a Make module performs (1 bundle = 1+ ops)
- **Module:** A box in the Make scenario canvas (e.g., Module 5 = OpenAI Script)
- **Variation ID:** Auto-generated unique identifier per row, includes timestamp
- **Polling:** Repeated API calls to check on a long-running job (HeyGen render)
