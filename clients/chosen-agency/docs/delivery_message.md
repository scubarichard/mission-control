# Upwork Delivery Message — Erika Cobb / Chosen Agency V1

Paste-ready message. Fill in the three Loom URLs and send.

---

## Subject (Upwork message thread)

V1 delivery — Content Pipeline ready for review

---

## Body

Hi Erika,

V1 of the Content Pipeline is built and tested. Everything from your spec is wired in: Sheet trigger → OpenAI script + editor brief → Google Docs → ElevenLabs voice → HeyGen avatar render → write-back. The editor brief follows your fixed 4-section structure, and the override pattern (System Settings + per-row overrides) is honored throughout — no hardcoded voices or avatars in the Make modules.

**Walkthroughs:**
- Full system overview: [LOOM URL 1]
- V1 scenario module-by-module: [LOOM URL 2]
- Daily operator flow: [LOOM URL 3]

**What's running:**
- V1 scenario `Chosen Agency - Content Pipeline V1` — picks up Status=Queued rows on a 15-min schedule, batches up to 5 rows per run
- Webhook scenario `Chosen Agency - HeyGen Webhook Receiver` — receives HeyGen render-complete callbacks and flips rows to Done
- Render Checker scenario `Chosen Agency — Render Checker` — runs every 5 min as a safety net for any callbacks that don't land

**Test results:**
9 test rows ran end-to-end successfully, including 4 override variants (voice override, avatar override, tone override, ElevenLabs settings override). Total time for a fresh batch of 5 rows: ~12 minutes from queue to Done.

**Documentation (in your Drive `10_Documentation` folder):**
- Operator SOP — daily workflow, status meanings, override settings, recovery steps
- Field Map — every column in the Queue tab + every Make module
- Credential Map — where every API key lives, plus a 5-step credential handoff procedure for when you take ownership
- Troubleshooting Guide — every bug encountered during build, with fixes

**Architecture note (relevant for scaling):**
HeyGen renders are handled via webhook callback rather than inline polling. This means renders can take 10 seconds or 2 hours and the system handles either gracefully — and there's no per-render Make.com operations cost during the wait. At your expected volume (5-20 videos/week per the spec) this is overkill, but it's already built and it scales for free.

**One thing to confirm before I close out:**
The HeyGen and ElevenLabs API keys are currently stored directly in the Make modules. When you take ownership of the build, the cleanest handoff is to swap to your own keys via Make's connection management UI (5-min job — covered in the Credential Map doc). I can either walk you through that on a quick call, or your developer can do it from the doc. Your call.

**On scope:**
What's in this delivery matches the V1 build window in your spec (Phases 1-4 plus the documentation phase). The advanced Phase 2+ scenarios you listed in Section 12 (Notion sync, Script Generator, AI Performance Classifier, Editor Bonus tools, etc.) are deferred per your own phasing — happy to scope those separately when you're ready.

Let me know if anything in the videos needs more detail. Otherwise this is ready for your acceptance review.

— Richard

---

## Notes for Richard before sending

1. Replace the three `[LOOM URL N]` placeholders with actual Loom URLs after recording.
2. Verify your Loom links are set to "anyone with the link can view" before sending.
3. If Erika prefers YouTube unlisted instead of Loom, swap accordingly. Loom is faster.
4. The "one thing to confirm" paragraph about API keys is intentionally soft — gives her a clean way to either request a call or just move forward. Don't sharpen it.
5. The "On scope" paragraph protects you against scope creep without being defensive. Reference Section 12 only if she asks for Phase 2 work in the same milestone.

## After Erika confirms acceptance

Apply for the milestone release on Upwork. Keep the Loom URLs in the Upwork message thread for your portfolio reference later.
