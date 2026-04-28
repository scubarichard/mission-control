# Editor Brief Prompt — Build Notes

**Task:** TASK-20260428-FORGE-CHOSEN-001
**Completed:** 2026-04-28
**Author:** Forge

---

## Model

**Working assumption: gpt-4o**

Erika has not yet confirmed the model. Kickoff sent Apr 28. Do not wire to production Make scenario until Erika confirms. If she wants gpt-4o-mini, retest — quality will degrade, especially on line-by-line specificity.

**Why gpt-4o:** Structured JSON output is reliable. Line-by-line visual direction requires strong contextual reasoning — gpt-4o-mini was not tested but is likely to produce generic directives.

---

## Token Cost (gpt-4o, Apr 2026 pricing)

| Test | Script length | Tokens in | Tokens out | Total | Cost |
|---|---|---|---|---|---|
| TEST-001 | ~100 words | 800 | 874 | 1,674 | $0.0106 |
| TEST-002 | ~70 words | 754 | 834 | 1,588 | $0.0098 |
| TEST-003 | ~50 words | 720 | 773 | 1,493 | $0.0089 |

**Average: ~$0.010 per brief** — well within the $0.02 budget.

Costs scale with script length and output richness. Expect ~$0.012–$0.015 for longer scripts (90–120s).

---

## Prompt Design Decisions

### Why JSON not markdown
JSON enables Make.com to map each section independently to Google Doc placeholders. Markdown would require regex parsing in Make, which is fragile. `response_format: { "type": "json_object" }` enforces valid JSON at the API level — no parse errors in testing.

### Why temperature 0.7
Lower (0.3–0.5) produced more generic, templated outputs — especially in Review Priorities. Higher (0.9) occasionally broke pacing format. 0.7 balances script-specific creativity with structural reliability.

### The AI avatar context line
Without it, the model wrote visual direction as if it were a live-action shoot. Adding "KEY CONTEXT: The base footage is an AI avatar talking to camera" immediately produced explicit avatar vs. b-roll decisions in every beat. This single line was the biggest quality improvement between v1 and v2 of the prompt.

### Directive quality enforcement
v1 prompt produced generic directives ("Use engaging visuals throughout"). Added explicit bad/good examples in the system prompt. v2 directives all reference specific quoted lines.

---

## Iteration Log

| Version | Issue | Fix |
|---|---|---|
| v1 | Pacing format inconsistent (free text) | Made format explicit: `[type] — [reason]` |
| v1 | Directives generic | Added bad/good examples, required line quotes |
| v1 | No avatar/b-roll distinction | Added KEY CONTEXT block about AI avatar |
| v2 | ✓ All tests pass quality bar | — |

---

## Flags for Richard / Erika

1. **Model confirmation required** before production wiring. gpt-4o assumed.
2. **No text overlays on Test 1 (sleep tips)** — model correctly judged the calming tone doesn't need on-screen text. Erika may want to add overlay guidance to the per-row override columns if she has a preference.
3. **Test 3 (agency script) line-by-line has 5 beats** — that script has 5 distinct sentences/beats. Coverage is complete; this is not a gap.
4. **Google Doc template (ID: 179Rc1u3mWVC-7hidFeyBLWxIp0Xxaocl_M52MsDc-4I)** needs placeholder text matching the keys in `editor_brief_v1.md` before Make scenario can write to it.

---

## Next Steps (separate task)

- [ ] Erika confirms model
- [ ] Wire prompt into Make Phase 2 scenario (after Script Doc module)
- [ ] Update Google Doc template with placeholders
- [ ] Test E2E with live row trigger
