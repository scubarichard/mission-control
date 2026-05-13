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

Generate 3 Scene 03 script variants, self-evaluate, pick best, regenerate if top score < 7.0/10. Generate Scene 01 intro + Scene 05 outro avatar scripts. Generate Scene 03 slide outline (4-6 slides). Internal QA gate: word count, banned words, no "you/your", no client names from private-mapping.md, sentence length cap, pause markers, all topics covered.

Banned words (zero tolerance): "powerful", "elegant", "robust", "seamless", "revolutionary", "game-changing", "world-class", "best-in-class"

Required topics:
- What the diagnostic engagement is
- What's delivered (bible, risk inventory, remediation plan, walkthrough video)
- Why it matters for regulated firms (compliance-aware, audit-friendly)
- The phased approach
- What makes 1AltX's approach different
- CTA preview

---

## Phase 2 — Render assets

1. ElevenLabs audio for Scene 03 (split at pause markers, validate duration ±15%)
2. ElevenLabs audio for Scene 01 + Scene 05
3. HeyGen avatar render for Scene 01 (retry once on error)
4. HeyGen avatar render for Scene 05
5. Scene 03 slide images via PIL (4-6 PNGs, validate file size)
6. Assemble Scene 03 video (slides + audio synced via FFmpeg)
7. Title card (Scene 02, 3 sec hold)
8. CTA card (Scene 04, 5 sec hold — EXACT locked wording)
9. Internal QA gate: all MP4s exist, durations match, codecs consistent

---

## Phase 3 — Assemble final

FFmpeg concat all 5 scenes. Loudness normalize to -16 LUFS. Output to `~/Dropbox/Companies/1AltX/Projects/_internal/catalogmint/final/31-final.mp4`. QA gate: duration 4-5 min, file size 50-200 MB, no frame drops, audio present.

---

## Phase 4 — Sanitization HARD GATE

Cross-reference all generated text against `private-mapping.md` from techwalkmint repo. If any client name match: HARD ABORT, no retry, email diagnostic. No dollar figures under $5K, no specific company names, no personal emails.

---

## Phase 5 — Publish

YouTube upload as UNLISTED (NEVER Public — non-negotiable). Update 1altx-site catalog.json with new item 31 entry. Commit and push to GitHub Pages.

---

## Phase 6 — Self-review

Score audio quality, visual quality, content quality, brand consistency (1-10 each). If any < 7: flag "REVIEW BEFORE PUBLISHING". If all >= 8: flag "READY TO FLIP PUBLIC".

---

## Phase 7 — Notify

Email richard@1altx.com with: unlisted URL, quality scores, recommended action (FLIP PUBLIC / REVIEW FIRST / RE-RUN), costs incurred, runtime, warnings, catalog.json diff, easy-rollback instructions.

Subject: `[Catalog-31] AUTO production complete — review unlisted URL`

Append production log entry at `~/Dropbox/Companies/1AltX/Projects/_internal/catalogmint/production-log.md`.

---

## Abort conditions (hard stops)

- Any client name appears in generated content
- Any API key fails authentication
- Total cost projection exceeds $25
- Same scene fails QA 3 times in a row
- YouTube upload fails 3 consecutive attempts
- Phase exceeds 2x expected runtime
- GitHub push fails

---

## Quality standards

- Audit-first: log every API call, every file written
- Per-scene production: each scene a separate MP4, surgical re-renders
- Pause discipline: real silence at markers
- Neutral framing: no personal address
- Brand consistency: 1AltX colors only
- Sanitization: NO client names anywhere
- Cold-spawn protection: phase reports a fresh agent could resume from

---

## Reusability

This task and brief are templates for future service-offering catalog videos. Items 32, 33+ just substitute the "Service offering" block at the top.
