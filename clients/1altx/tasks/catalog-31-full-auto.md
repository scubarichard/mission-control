# Catalog Item 31 — Full Auto Production Brief

**Item:** 31 — "Make.com Pipeline Diagnostic for Regulated Firms"
**Mode:** Full autopilot (zero human intervention until final unlisted URL)
**Estimated runtime:** 30-50 minutes
**Estimated cost:** $5-12 (HeyGen + ElevenLabs)

---

## Success criteria

- Produce a 4-5 minute branded catalog video
- Upload to 1AltX YouTube as UNLISTED (never Public)
- Update 1altx-site catalog.json with new item entry
- Commit and push to GitHub Pages
- Email completion report to richard@1altx.com
- All phases must pass internal QA before proceeding

---

## Service offering (the subject of this video)

- **ID:** 31
- **Title:** Make.com Pipeline Diagnostic for Regulated Firms
- **Tags:** Make.com, n8n, Diagnostic, Compliance
- **Target audience:** RIAs, family offices, accounting firms, regulated services businesses with broken or inherited automation
- **Positioning:** Structural diagnostic + remediation roadmap. NOT a rebuild offer. Audit-first, read-only approach. Phased delivery.
- **Differentiator:** 15+ years RIA experience, compliance-aware (SEC/FINRA), Make.com Advanced certified
- **Price point to mention:** "starts at $2,500" — fixed price, scoped engagement
- **Deliverables to highlight:** Diagnostic bible (30 pages), risk inventory, remediation plan, walkthrough video, handoff package

---

## Reference repositories

| Repo | Purpose | Access path |
|---|---|---|
| TechWalkMint methodology | Script authoring rules, production model | `github.com/scubarichard/techwalkmint` (private — needs PAT) |
| CatalogMint scripts | Existing video production pipeline | `~/Dropbox/Companies/1AltX/Projects/_internal/catalogmint` (Forge-local; Nautilus needs SMB or git-mirror) |
| 1AltX website | Update target — `data/catalog.json` | `~/1altx-site` |

Read these first:
- TechWalkMint `SKILL.md`
- TechWalkMint `methodology/03-video-production-model.md`
- TechWalkMint `references/catalog-adaptation.md`
- TechWalkMint `lessons-learned/project-b-lessons.md`
- CatalogMint `SKILL.md`
- CatalogMint `production-log.md`

Hybrid pattern: CatalogMint wrapper (intro/title/CTA/outro) + TechWalkMint-produced Scene 03 content (script + slides + voiceover). This hybrid is not yet documented in TechWalkMint — agent should draft `references/catalog-hybrid-pattern.md` as part of this task and commit alongside.

---

## Locked production parameters (DO NOT MODIFY)

**ElevenLabs:**
- Voice: secret `ELEVENLABS-VOICE-ID-RICHARD` in Azure Key Vault `kvdaximpactcapital`
- API key: secret `ELEVENLABS-API-KEY`
- Model: `eleven_multilingual_v2`
- Stability: 0.55 (marketing variant — slightly more animated than the 0.65 technical baseline)
- Similarity: 0.75
- Style: 0
- Speaker boost: true

**HeyGen:**
- Avatar: Richard's custom avatar (ID in catalogmint configs)
- Quality: high
- Resolution: 1920x1080

**FFmpeg:**
- Codec: H.264, AAC audio
- Frame rate: 30 fps
- Sample rate: 48 kHz
- Loudness normalization: -16 LUFS
- Concat method: lossless (`-c copy` when possible)

**Cards (PIL):**
- Background: `#0a0a0a`
- Accent color: `#58a6ff`
- Font: Plus Jakarta Sans (fallback: Inter)
- Resolution: 1920x1080

**CTA card script (EXACT WORDING — never modify):**

> "You'll be amazed how much manual work disappears when the right automation kicks in. Visit onealtx.com and schedule a call — we'll scope it, size it, and give you a straight price."

---

## Phase 1 — Draft (with internal QA)

### Step 1.1 — Generate 3 script variants for Scene 03

Requirements for each variant:
- Length: 600-700 words spoken (~3-4 min ElevenLabs audio)
- Structure: 4-5 sections, each with `[pause-think]` transition
- Pause markers: `[pause]`, `[pause-think]`, `[pause-long]` used throughout
- Sentence cap: 25 words maximum per sentence
- Banned words (zero tolerance): "powerful", "elegant", "robust", "seamless", "revolutionary", "game-changing", "world-class", "best-in-class"
- No personal address ("you", "your") — use "the firm", "the client", "the team"
- No client names — use anonymized patterns ("a regulated wealth management firm")
- Audience framing: prospect researching diagnostic services
- Voice: confident but humble; technical but accessible

Content the script must cover:
- What the diagnostic engagement is (structural review of existing system)
- What's delivered (bible, risk inventory, remediation plan, walkthrough video)
- Why it matters for regulated firms (compliance-aware, audit-friendly)
- The phased approach (Phase 1 diagnostic standalone; Phase 2+ if approved)
- What makes 1AltX's approach different (15+ years RIA experience, Make.com Advanced cert, audit-first discipline)
- CTA preview (full CTA delivered in Scene 04 — Scene 03 sets it up)

### Step 1.2 — Self-evaluate each variant (1-10 per dimension)

- Tone calibration (confident but humble, no superlatives)
- Pacing (pause markers sufficient, sentence length appropriate)
- Content coverage (all 6 required topics addressed)
- Brand alignment (1AltX positioning, no client names)
- Audience appropriateness (prospect-facing, not technical jargon)
- Sentence-by-sentence quality (any awkward phrases?)

### Step 1.3 — Pick the highest-scoring variant

If top score < 7.0/10 average, regenerate with adjustment notes. After 3 attempts at < 7.0, ABORT and email Richard with the best attempt + diagnostic.

### Step 1.4 — Generate Scene 01 avatar intro script

~50 words, 20 sec spoken. Hook the prospect with the problem. Tease what the video covers. Same tone rules apply.

### Step 1.5 — Generate Scene 05 avatar outro script

~50 words, 20 sec spoken. Reinforce key value. Direct to onealtx.com. Same tone rules apply.

### Step 1.6 — Generate Scene 03 slide outline

- 4-6 slides total
- Each slide aligns to a section of the Scene 03 script
- Slide content: title + 3-5 bullet points or key visual element
- Brand colors only, no client logos

### Step 1.7 — Write all drafted content

Write to `/tmp/catalog-31-draft.md` for the completion report.

### Step 1.8 — Internal QA gate

- [ ] Script word count 600-700 (Scene 03)
- [ ] No banned words present
- [ ] No "you/your" pronouns
- [ ] No client names from `private-mapping.md` list (techwalkmint repo)
- [ ] Sentence length max 25 words throughout
- [ ] At least 8 pause markers in Scene 03
- [ ] All 6 required topics covered

If any check fails: regenerate Scene 03 (up to 3 retries). After 3 retries, ABORT and escalate.

---

## Phase 2 — Render assets

### Step 2.1 — ElevenLabs audio for Scene 03

- Split script at pause markers
- Generate per-segment audio
- Insert FFmpeg silence at pause markers: `[pause]` = 0.7s, `[pause-think]` = 1.0s, `[pause-long]` = 1.5s
- Concat to single audio file
- Validate: total duration within ±15% of expected (3-4 min)

### Step 2.2 — ElevenLabs audio for Scene 01 + Scene 05

Same per-segment generation. Validate durations.

### Step 2.3 — HeyGen avatar for Scene 01

- Input: Scene 01 audio + script text
- Output: 1920x1080 MP4
- Validate: duration matches audio ±0.5s
- Retry once if HeyGen returns error; ABORT after 2 failures

### Step 2.4 — HeyGen avatar for Scene 05

Same logic as Step 2.3.

### Step 2.5 — Scene 03 slide images via PIL

- One PNG per slide (4-6 total)
- 1920x1080, brand colors (`#0a0a0a` bg, `#58a6ff` accent)
- Plus Jakarta Sans font (download if not on system)
- Validate: file size > 50KB (catches blank/failed renders)

### Step 2.6 — Assemble Scene 03 video

- Sync slide images to audio timeline
- Slide N duration = audio segment N + transition silence
- FFmpeg compose: slides as video stream, ElevenLabs as audio stream
- Validate: total Scene 03 duration matches audio file ±0.2s

### Step 2.7 — Render Scene 02 title card (3 sec hold)

- Title: "Make.com Pipeline Diagnostic"
- Subtitle: "For Regulated Firms"
- Brand colors, brand font

### Step 2.8 — Render Scene 04 CTA card (5 sec hold)

- Use EXACT locked CTA wording from production parameters
- Standard CatalogMint CTA card design

### Step 2.9 — Internal QA gate

- [ ] All 5 scene MP4s exist and play
- [ ] Durations within tolerance
- [ ] Codecs consistent (H.264 + AAC)
- [ ] Resolution consistent (1920x1080)
- [ ] Frame rates match (30 fps)
- [ ] Audio sample rates match (48 kHz)

If any check fails: regenerate the failing scene (up to 2 retries). After 2 retries on same scene, ABORT.

---

## Phase 3 — Assemble final

### Step 3.1 — FFmpeg concat all 5 scenes in order

1. Scene 01 (intro avatar)
2. Scene 02 (title card)
3. Scene 03 (methodology explainer)
4. Scene 04 (CTA card)
5. Scene 05 (outro avatar)

### Step 3.2 — Loudness normalize to -16 LUFS

### Step 3.3 — Output path

`~/Dropbox/Companies/1AltX/Projects/_internal/catalogmint/final/31-final.mp4`

### Step 3.4 — Internal QA gate

- [ ] Final duration 4-5 min (240-300 sec)
- [ ] File size 50-200 MB
- [ ] No frame drops in ffprobe report
- [ ] Audio waveform present (not silent)
- [ ] No transition artifacts

---

## Phase 4 — Sanitization HARD GATE

### Step 4.1 — Cross-reference all text against private-mapping.md

- Read `private-mapping.md` client name list from techwalkmint repo
- Search ALL script files, ALL slide text, ALL metadata for any match
- If even one match: HARD ABORT, no retry, email diagnostic to Richard

### Step 4.2 — Additional sanitization patterns

- No specific dollar figures under $5K (use ranges)
- No specific company names visible
- No personal email addresses
- No specific dates that could identify an engagement

### Step 4.3 — Proceed or abort

If sanitization passes, proceed to Phase 5. If fails, ABORT.

---

## Phase 5 — Publish

### Step 5.1 — Upload to YouTube

Use existing CatalogMint upload script:
- Channel: 1AltX
- **Visibility: UNLISTED (NEVER Public — non-negotiable)**
- Title: "Make.com Pipeline Diagnostic for Regulated Firms | 1AltX"
- Description: Generated from script summary + standard 1AltX boilerplate
- Tags: make.com, automation, diagnostic, RIA, compliance, wealth management
- Playlist: "Automation Catalog"

### Step 5.2 — Capture YouTube video ID and unlisted URL

### Step 5.3 — Update catalog.json

Add new entry to `~/1altx-site/data/catalog.json`:

```json
{
  "id": "31",
  "title": "Make.com Pipeline Diagnostic for Regulated Firms",
  "desc": "Structural diagnostic + remediation roadmap for inherited or broken Make.com pipelines. Audit-first, compliance-aware approach. Starts at $2,500.",
  "tools": ["Make.com", "n8n", "Diagnostic", "Compliance"],
  "youtube_id": "{CAPTURED_ID}",
  "youtube_url": "https://youtu.be/{CAPTURED_ID}",
  "status": "published"
}
```

### Step 5.4 — Commit and push to GitHub Pages

```bash
cd ~/1altx-site
git add data/catalog.json
git commit -m "[Forge] Add catalog item 31: Make.com Pipeline Diagnostic service"
git push origin main
```

(Substitute appropriate signer tag based on which agent executes.)

---

## Phase 6 — Self-review

### Step 6.1 — Quality report

Examine:
- Final video metadata (ffprobe full output)
- Script quality scores from Phase 1.2
- Any retries that occurred during rendering
- API costs accumulated (ElevenLabs char count + HeyGen render count)
- Time elapsed per phase

### Step 6.2 — Self-assess: "Would this pass a human reviewer's bar?"

Score each (1-10):
- Audio quality: clarity, pacing, pronunciation
- Visual quality: slide design, transitions, brand alignment
- Content quality: does it sell the service well
- Brand consistency: matches existing CatalogMint videos

If any score < 7: flag for "REVIEW BEFORE PUBLISHING" in the email.
If all scores >= 8: flag for "READY TO FLIP PUBLIC" in the email.

---

## Phase 7 — Notify

### Step 7.1 — Email richard@1altx.com

Subject: `[Catalog-31] AUTO production complete — review unlisted URL`

Body contents:
- Unlisted YouTube URL (for visual review)
- Quality scores from Phase 6
- Recommended next action (FLIP PUBLIC / REVIEW FIRST / RE-RUN)
- Cost incurred (HeyGen + ElevenLabs totals)
- Total runtime
- Any warnings or retries encountered
- catalog.json diff applied
- Easy-rollback instructions (if Richard rejects):
  - Delete YouTube video
  - Revert commit: `git revert HEAD && git push`

### Step 7.2 — Append to production log

Append a new section for item 31 to:
`~/Dropbox/Companies/1AltX/Projects/_internal/catalogmint/production-log.md`

---

## Abort conditions (hard stops)

Stop immediately and email Richard with diagnostic if:
- Any client name appears in any generated content (Phase 4 sanitization)
- Any API key fails authentication
- Total cost projection exceeds $25
- Same scene fails QA 3 times in a row
- YouTube upload fails 3 consecutive attempts
- Phase exceeds 2x expected runtime
- GitHub push to 1altx-site fails

---

## Quality standards (apply throughout)

- **Audit-first:** log every API call, every file written
- **Per-scene production:** each scene is a separate MP4, allowing surgical re-renders
- **Pause discipline:** real silence at pause markers, no music or sting
- **Neutral framing:** no personal address ("you", "your team"), use "the client" / "the build team" / "the firm"
- **Brand consistency:** 1AltX colors only, no client brand colors
- **Sanitization:** NO client names anywhere in script, slides, or audio
- **Cold-spawn protection:** produce a report at each phase that a fresh agent could pick up from

---

## Notes for executing agent

- This task is reusable. Future service-offering catalog videos (item 32, 33...) just substitute the "Service offering" section at the top of this brief.
- The hybrid CatalogMint+TechWalkMint pattern documented here should be committed back to the techwalkmint repo as `references/catalog-hybrid-pattern.md` so it's available for future runs.
- If running on Nautilus (Linux), you'll need to clone or SMB-mount the CatalogMint scripts from the Windows Dropbox folder. Forge has direct access and is the easier execution path.
- Cold-spawn safe: a fresh agent with no prior context can pick this up from this file alone.
