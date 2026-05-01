# Chosen Agency — Followups & Future Improvements

Items intentionally deferred from V1 build. Worth revisiting in Phase 2 conversations or future engagements.

---


## 2026-04-28 — Editor Brief: Claude vs OpenAI

**Status:** Shipping V1 with GPT-4o per Erika's SOW (Section 11.1 specifies OpenAI). Quality bar met by Forge's prompt (TASK-20260428-FORGE-CHOSEN-001).

**Possible improvement:** Claude Sonnet 4.5 likely produces more specific, format-adherent, tone-matched briefs than GPT-4o for this use case. Forge's prompt had to add explicit bad/good examples to suppress GPT-4o's tendency toward generic directives — Claude tends to specificity natively.

**Why deferred:**
- Erika's SOW explicitly specifies OpenAI
- GPT-4o output passed quality bar across all 3 test scripts
- Adds a model-choice question to Erika's plate during kickoff
- Marginal quality bump, not transformational

**When to revisit:**
- If Erika ever requests "can we make the briefs even better"
- Phase 2 conversation if quality becomes a discussion point
- If she ever wants to optimize cost AND increase quality (Claude Haiku might match GPT-4o quality at lower cost — worth testing)

**Other Claude opportunity (separate):** Script GENERATION step (different from Brief). Claude's writing quality is meaningfully better than GPT-4o for short-form, tone-driven content. Worth raising with Erika if she wants to optimize that side of the pipeline.

---


## 2026-04-30 — HeyGen Polling ? Webhook Conversion (Phase 2 enhancement)

**Status:** Deferred. V1 ships with 40-iteration inline polling (40 min ceiling) + standalone Render Checker scenario (CHOSEN-005) as safety net.

**The Issue:** HeyGen video renders sometimes exceed inline polling window. Tonight's test took >20 min, hit ceiling before completion. Bumping iterations works but consumes Make ops linearly.

**Proposed Improvement:** Convert HeyGen result handling from polling to webhook callback.

**How it would work:**
- Module 10 (HeyGen create) passes `callback_id` and `callback_url` parameters
- Separate Make webhook receiver scenario sits at the callback URL
- When HeyGen finishes rendering, it POSTs result to Make webhook
- Webhook scenario looks up V1 sheet row by callback_id (= Variation ID), updates Status=Done with Raw Video Link
- Inline polling reduced to 5-10 iterations (catches fast renders) or removed entirely

**Benefits:**
- Zero wasted Make ops on polling (current cost: ~60 ops per render)
- Scales to unlimited concurrent renders
- Lower latency (HeyGen pings instantly on completion)
- Works regardless of render duration (10 sec or 2 hours)
- Industry-standard async pattern

**Costs to build:**
- ~2-3 hours engineering time
- 1 new Make webhook scenario
- Update Module 10 to add callback params
- Edge case handling: if webhook scenario is paused, callbacks drop (mitigated by Render Checker safety net)

**When to revisit:**
- When Erika's volume exceeds ~50 renders/week
- If polling ops costs become noticeable on Make plan
- Phase 2 enhancement opportunity

**Why deferred:**
- V1 polling + Render Checker handles current expected volume (5-20 videos/week)
- Polling cost at this scale: ~.50/month in Make ops
- Engineering ROI doesn't pencil at low volume
- Architecture is layered — current solution is "right-sized for V1"

---
