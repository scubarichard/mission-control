# Catalog Item 31 — Full Auto Production Brief

## ⚠️ SCOPE CLARIFICATION (READ THIS FIRST)

**This task produces ONE NEW VIDEO. Catalog item 31. That is the entire scope.**

You are NOT producing or reprocessing any of:
- Catalog items 01-30 (already produced, finals exist in Dropbox catalogmint/final/)
- The "13 existing videos" referenced in CatalogMint SKILL.md Phase 1 Workflow
- Any prior CatalogMint batch work

If you find yourself looking at items 01-30 or processing more than one final MP4, STOP. You are off-task. The only output of this task is `31-final.mp4` (one file) and one new entry in catalog.json.

---

## What this task IS

**Item:** 31 — "Make.com Pipeline Diagnostic for Regulated Firms"
**Mode:** Full autopilot (zero human intervention until final unlisted URL)
**Estimated runtime:** 30-50 minutes
**Estimated cost:** $5-12 (HeyGen + ElevenLabs)

Produce one new branded catalog video promoting a new 1AltX service offering. Upload to YouTube UNLISTED. Update catalog.json with one new entry (id "31"). Email Richard. Done.

---

## Success criteria

- ONE 4-5 minute branded MP4 produced at `~/Dropbox/Companies/1AltX/Projects/_internal/catalogmint/final/31-final.mp4`
- ONE YouTube upload as UNLISTED (never Public)
- ONE new entry appended to `~/1altx-site/data/catalog.json` with id "31"
- ONE commit + push to 1altx-site GitHub Pages
- ONE email to richard@1altx.com with the unlisted URL

If you produce more than one of any of those things, you are off-task.

---

## Service offering (the subject of this single video)

- **ID:** 31
- **Title:** Make.com Pipeline Diagnostic for Regulated Firms
- **Tags:** Make.com, n8n, Diagnostic, Compliance
- **Target audience:** RIAs, family offices, accounting firms, regulated services businesses with broken or inherited automation
- **Positioning:** Structural diagnostic + remediation roadmap. NOT a rebuild offer. Audit-first, read-only approach. Phased delivery.
- **Differentiator:** 15+ years RIA experience, compliance-aware (SEC/FINRA), Make.com Advanced certified
- **Price point to mention:** "starts at $2,500" — fixed price, scoped engagement
- **Deliverables to highlight:** Diagnostic bible (30 pages), risk inventory, remediation plan, walkthrough video, handoff package

---

## Reference material (read for FORMAT and METHODOLOGY only, not as work-to-do)

These are reference documents. Read them to understand the format and tooling. DO NOT execute any production pipelines or batch jobs you find in them.

| Reference | What to use it for | What NOT to use it for |
|---|---|---|
| TechWalkMint `SKILL.md` | Methodology for narrated walkthroughs | Don't produce a 20-minute architecture walkthrough; this is a 5-min marketing video |
| TechWalkMint `references/catalog-adaptation.md` | Adapting walkthroughs for marketing/catalog format | — |
| TechWalkMint `lessons-learned/project-b-lessons.md` | Diagnostic engagement context (informs the script content) | — |
| CatalogMint `SKILL.md` | Wrapper format (intro/title/Scene 03/CTA/outro), card design, locked parameters | **DO NOT process "the 13 existing videos" — those are completed** |
| CatalogMint `production-log.md` | Example of completed work format | **DO NOT reprocess any item listed there** |

**Critical:** CatalogMint SKILL.md has a section titled "Phase 1 Workflow (The 13 Existing Videos)." That phase is DONE. Items 01-30 are produced. Your task is item 31 (one new item) and nothing else.

---

## Locked production parameters (DO NOT MODIFY)

**ElevenLabs:**
- Voice: secret `ELEVENLABS-VOICE-ID-RICHARD` in Azure Key Vault `kvdaximpactcapital`
- API key: secret `ELEVENLABS-API-KEY`
- Model: `eleven_multilingual_v2`
- Stability: 0.55, Similarity: 0.75, Style: 0, Speaker boost: true

**HeyGen:**
- Avatar: Richard's custom avatar (ID in catalogmint configs)
- Quality: high, Resolution: 1920x1080

**FFmpeg:** H.264 + AAC, 30fps, 48kHz, -16 LUFS, lossless concat where possible

**Cards (PIL):** `#0a0a0a` bg, `#58a6ff` accent, Plus Jakarta Sans (fallback Inter), 1920x1080

**CTA card script (EXACT WORDING — never modify):**
> "You'll be amazed how much manual work disappears when the right automation kicks in. Visit onealtx.com and schedule a call — we'll scope it, size it, and give you a straight price."

---

## Production scope (just for item 31)

Produce exactly 5 scenes for one video:

1. **Scene 01** — HeyGen avatar intro (~20 sec). New script. Hook the prospect.
2. **Scene 02** — Title card (3 sec). "Make.com Pipeline Diagnostic" / "For Regulated Firms"
3. **Scene 03** — Methodology explainer (3-4 min). New script + new slides + ElevenLabs voiceover.
4. **Scene 04** — CTA card (5 sec). Exact locked wording.
5. **Scene 05** — HeyGen avatar outro (~20 sec). New script. Reinforce + direct to onealtx.com.

Concat → loudness normalize → output to `31-final.mp4`. Upload UNLISTED. Update catalog.json. Email Richard. Done.

---

## Scene 03 script requirements

Length: 600-700 words spoken (~3-4 min audio).
Sentence cap: 25 words max.
Pause markers required: `[pause]` (0.7s), `[pause-think]` (1.0s), `[pause-long]` (1.5s).
Banned words: "powerful", "elegant", "robust", "seamless", "revolutionary", "game-changing", "world-class", "best-in-class".
No personal address ("you", "your") — use "the firm", "the client", "the team".
No client names — use anonymized patterns ("a regulated wealth management firm").

Topics the script must cover:
1. What the diagnostic engagement is (structural review of existing system)
2. What's delivered (bible, risk inventory, remediation plan, walkthrough video)
3. Why it matters for regulated firms (compliance-aware, audit-friendly)
4. The phased approach (Phase 1 diagnostic standalone; Phase 2+ if approved)
5. What makes 1AltX's approach different (15+ years RIA experience, Make.com Advanced cert, audit-first discipline)
6. CTA preview (Scene 04 delivers the full CTA)

Internal QA: regenerate up to 3 times if any check fails (word count, banned words, no "you/your", no client names, sentence cap, pause markers, all 6 topics). After 3 retries, ABORT.

---

## Slides for Scene 03

4-6 slides total. One per script section. Brand colors only. No client logos.

---

## Phase order (linear, no parallel)

1. **Draft** — Scene 01 script + Scene 03 script + Scene 03 slides + Scene 05 script. Internal QA pass.
2. **Render audio** — ElevenLabs for Scene 01, 03, 05.
3. **Render visuals** — HeyGen for Scene 01 + Scene 05. PIL slides for Scene 03. PIL cards for Scene 02 + Scene 04.
4. **Assemble Scene 03** — slides + audio synced via FFmpeg.
5. **Concat all 5 scenes** — single MP4 at 31-final.mp4. Loudness normalize.
6. **Sanitize** — HARD GATE. Cross-reference all text against `private-mapping.md` from techwalkmint repo. If any client name match, ABORT and email diagnostic.
7. **Publish** — YouTube upload as UNLISTED. Update catalog.json. Commit + push to 1altx-site.
8. **Self-review** — score audio/visual/content/brand 1-10 each.
9. **Notify** — email richard@1altx.com with unlisted URL + scores + cost + warnings.

---

## Abort conditions (hard stops)

Stop immediately and email Richard if:
- You catch yourself processing more than one final video → ABORT (off-task)
- Any client name appears in generated content (Phase 6 sanitization)
- Any API key fails authentication
- Total cost projection exceeds $25
- Same scene fails QA 3 times in a row
- YouTube upload fails 3 consecutive attempts
- Phase exceeds 2x expected runtime
- GitHub push to 1altx-site fails

---

## Final deliverables (count: exactly these, no more)

- 1× `31-final.mp4` at `~/Dropbox/Companies/1AltX/Projects/_internal/catalogmint/final/31-final.mp4`
- 1× YouTube video (UNLISTED, not Public)
- 1× new entry in `~/1altx-site/data/catalog.json`
- 1× commit pushed to scubarichard/1altx-site master
- 1× email to richard@1altx.com with the unlisted URL

Anything beyond this list is off-task.
