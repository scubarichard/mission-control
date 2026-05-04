# Chosen Agency — Followups & Phase 2 Items

**Last Updated:** 2026-05-04

Tracks deferred work, future enhancements, and items requiring Erika's input.

---

## V1.5 Architecture Decisions (Made 2026-05-04)

### Decision: HeyGen Text Mode (not ElevenLabs Direct)

**Why:** ElevenLabs REST `/text-to-speech` endpoint silently strips SSML break tags. Direct PowerShell test confirmed: explicit 2-second `<break>` tags produced zero audible pauses. HeyGen's `voice.type: text` mode honors SSML correctly (proven by CatalogMint).

**Architecture:**
- Module 5 generates script with SSML break tags
- Modules 7-9 disabled (ElevenLabs direct, Drive upload, Voice Done status)
- Module 10 sends script directly to HeyGen with linked voice ID
- HeyGen handles TTS internally with proper pacing

**Voice ID currently in use:** `a9c42ba3dd4b441eac3fb3221c6fcf59` (Richard's HeyGen-linked voice — for testing). At handoff, Erika's HeyGen voice ID replaces this.

---

## Deferred to Phase 2

### HeyGen Webhook Conversion

**Status:** Deferred. V1.5 ships with 40-iteration inline polling + standalone Render Checker as safety net.

**What it would do:** Convert from polling to HeyGen callback URL. Module 10 passes `callback_id` and `callback_url`. When render completes, HeyGen POSTs to a separate Make webhook scenario which updates the sheet.

**Benefits:** Zero polling ops cost, scales to unlimited concurrent renders, lower latency.

**Build effort:** ~2-3 hours.

**When to revisit:** Erika exceeds ~50 renders/week, or Make ops costs become noticeable.

---

### ElevenLabs Voice Settings (Stability/Similarity)

**Status:** Deferred. Currently uses HeyGen's defaults for the linked voice.

**Override columns S, T in V1 sheet:** Override ElevenLabs Stability + Similarity Boost — these were designed for the V1 ElevenLabs-direct architecture. Under V1.5, voice settings are configured in HeyGen's voice linking step, not per-row.

**Future:** if Erika needs per-row voice variation, we'd need to either revert to ElevenLabs direct (with non-SSML pacing) OR find a HeyGen API path to override voice settings per call.

---

### Notion Integration

**Status:** Erika asked. Recommendation: defer to Phase 2 OR add as $400-500 paid add-on.

**V1 ships with:** Manual updates if Erika wants Notion sync.

**Phase 2 build (if approved):**
- Notion database mirrors V1 sheet schema
- Bidirectional sync via n8n or Make
- Estimated effort: 3-4 hours

---

### Higgsfield Integration

**Status:** Erika asked. Recommendation: defer to Phase 2 OR add as $400-500 paid add-on.

**Build effort:** 4-6 hours (research + integration + testing).

---

## Outstanding External Dependencies

### From Erika

- [ ] Confirm Notion approach (Phase 2 defer or pay add-on)
- [ ] Confirm Higgsfield approach (Phase 2 defer or pay add-on)
- [ ] OpenAI account signup + invite richard@1altx.com
- [ ] HeyGen account with sufficient plan + invite richard@1altx.com (or share API key)
- [ ] ElevenLabs account (only needed if reactivating Modules 7-9)
- [ ] Share parent Drive folder with richard@1altx.com (current: `17jLeE_EaJMsPHdAFm1uKeGAvubvrqMO0`)
- [ ] Decide on her preferred avatar(s) — Tyler is current default
- [ ] Decide on her preferred voice — needs HeyGen voice ID

### From Richard

- [ ] Manually import Render Checker blueprint into Make (write API doesn't allow)
- [ ] Test V1.5 end-to-end with real test row (reset Row 3 → Run Once)
- [ ] Verify text-mode HeyGen video URL has audible pauses (test video already generated 2026-05-04)
- [ ] Migrate Drive folders to Erika's parent folder once shared
- [ ] Swap OAuth + API keys to Erika's accounts at handoff
- [ ] Record Loom walkthrough video for Erika
- [ ] Final handoff Slack message + Upwork milestone release

---

## Productization Notes

V1 architecture is reusable as a "Content Pipeline" template for other clients.

**Estimated productization value:**
- Per-install pricing: $3,000-5,000
- Per-client adaptation time: 4-6 hours
- Comparable templates (Zapier/Make stores): $50-200 one-time + custom config

**Key reuse components:**
- V1 sheet schema (proven)
- Make scenario blueprint (proven)
- Script + Brief OpenAI prompts (proven, reusable)
- Doc templates (Script + Brief, easily branded)
- HeyGen text-mode pattern (proven via CatalogMint)
- Render Checker pattern (proven safety net)
- 4 docs (Operator SOP, Field Map, Credential Map, Troubleshooting) — easily adapted per client

**Differentiation from Zapier templates:**
- Includes editor brief generation (most don't)
- Override columns for per-row customization
- Render Checker safety net
- SSML pacing instructions baked into prompt
- Phase 6 docs (most templates ship docless)

---

## Bug Watchlist (Things to Monitor)

- **Make UI lock state** — phantom "scenario running" errors. Mitigation: stop in History panel or wait 5-15 min.
- **HeyGen API key scope** — V1's original key (sk_V2_hgu_kXkUIXPwY...) returns 401 for `/v2/voices` and `/v2/avatars` but works for `/v2/video/generate`. Possible plan-tier limitation. Currently using CatalogMint key (sk_V2_hgu_k8ZrvzbzULJ...) which works on all endpoints.
- **HeyGen render timeouts** — If renders consistently exceed 40 min polling window, the Render Checker will catch them. If even RC misses them, may need to bump RC frequency from 5 min to 2 min.
- **OpenAI JSON malformation** — Occasionally Module 5 or Module 23 returns markdown-wrapped JSON instead of raw. Mitigated by `response_format: json_object` parameter, but still worth monitoring.
