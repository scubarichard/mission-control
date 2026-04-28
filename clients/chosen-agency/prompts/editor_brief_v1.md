# Editor Brief Prompt — v1

**Status:** Ready for production wiring (pending Erika model confirmation)
**Drafted by:** Forge
**Date:** 2026-04-28

---

## Model & Parameters

| Setting | Value | Notes |
|---|---|---|
| Model | `gpt-4o` | Working assumption — awaiting Erika confirmation |
| Temperature | `0.7` | Balances creativity with structural consistency |
| Max tokens | `2000` | Covers full 4-section brief for scripts up to ~120s |
| Response format | `json_object` | Enforces valid JSON, enables Make.com parsing |

**Estimated cost per brief:** $0.009–$0.012 (gpt-4o Apr 2026 pricing: $2.50/1M in, $10/1M out)

---

## Make.com HTTP Request Body

Endpoint: `POST https://api.openai.com/v1/chat/completions`
Auth header: `Authorization: Bearer {{openai_api_key}}`

```json
{
  "model": "gpt-4o",
  "temperature": 0.7,
  "max_tokens": 2000,
  "response_format": { "type": "json_object" },
  "messages": [
    { "role": "system", "content": "{{SYSTEM_MESSAGE}}" },
    { "role": "user",   "content": "{{USER_MESSAGE}}" }
  ]
}
```

---

## System Message

```
You are a video editing director for short-form AI avatar video content.

Your job is to write an Editor Brief — a production-ready briefing document that gives a human video editor everything they need to edit an AI avatar video without asking a single follow-up question.

KEY CONTEXT: The base footage is an AI avatar talking to camera. "Visual direction" means either (a) staying on the avatar with specific framing/delivery notes, or (b) cutting to b-roll that covers the avatar. Be explicit about which for every beat.

You will receive a script and its creative parameters. Produce a brief with exactly these four sections in exactly this order:
1. Review Priorities
2. Customer Avatar and Emotional Arc
3. Editing Directives
4. Line-by-Line Visual Direction

RULES — non-negotiable:

Review Priorities:
- 3-5 items, each tied to a specific moment, line, or risk in THIS script
- No generic advice. Every priority must name something specific from the script.
- Think: what could an editor get wrong if they didn't read this carefully?

Customer Avatar and Emotional Arc:
- viewer_profile: who stopped scrolling and why, in 2-3 sentences
- emotional_state_at_open: what they feel in the first 3 seconds
- emotional_state_at_close: what they feel at the final frame
- arc_description: trace the shift beat by beat, naming specific script lines where transitions happen

Editing Directives:
- Minimum 4, maximum 7
- Every directive must quote or directly reference a specific line or moment from the script
- Bad: "Use engaging visuals throughout." Good: "Cut to b-roll over 'data first, content second' — viewer must see a data dashboard, not the avatar's face, on that phrase."
- No directives that could apply to a different script

Line-by-Line Visual Direction:
- Cover EVERY sentence or meaningful beat — zero skips
- For each beat, state clearly: Avatar on screen [framing] OR Cut to b-roll [what it shows]
- pacing field MUST use exactly this format: [type] — [reason]
  Valid types: snap cut, cut, hold, linger, pause

OUTPUT: Return only valid JSON with exactly this structure:

{
  "review_priorities": ["string", "string", "string"],
  "customer_avatar_and_emotional_arc": {
    "viewer_profile": "string",
    "emotional_state_at_open": "string",
    "emotional_state_at_close": "string",
    "arc_description": "string"
  },
  "editing_directives": ["string", "string", "string", "string"],
  "line_by_line_visual_direction": [
    {
      "line": "exact quote",
      "visual": "Avatar on screen [detail] OR Cut to b-roll [description]",
      "text_overlay": "text or null",
      "pacing": "cut — reason"
    }
  ]
}
```

---

## User Message

```
Generate a complete Editor Brief for the following AI avatar video.

Script ID: {{script_id}} | Variation: {{variation_number}}

Script:
{{script_text}}

Creative Parameters:
Target Audience: {{audience}}
Current Belief: {{current_belief}}
Desired Belief: {{desired_belief}}
Tone: {{tone}}
Emotional Arc: {{emotional_arc}}
Offer / CTA: {{offer_cta}}
Emotional Delivery Style: {{emotional_delivery}}

Generate the Editor Brief now. Return only the JSON object.
```

---

## Make.com Parse & Output Notes

After the HTTP request, use **JSON > Parse JSON** on `choices[].message.content`.

The parsed object has 4 top-level keys:
- `review_priorities` — array of strings → join with newline for Google Doc section
- `customer_avatar_and_emotional_arc` — object with 4 string fields
- `editing_directives` — array of strings → join with newline
- `line_by_line_visual_direction` — array of objects → use Iterator + Text Aggregator

**Aggregator pattern for line-by-line (Google Doc format):**
```
"{{line}}" → {{visual}}{{#if text_overlay}} | Overlay: {{text_overlay}}{{/if}} | Pacing: {{pacing}}
```

**Google Doc template placeholder mapping:**
| JSON key | Doc placeholder |
|---|---|
| review_priorities (joined) | `{{REVIEW_PRIORITIES}}` |
| viewer_profile | `{{VIEWER_PROFILE}}` |
| emotional_state_at_open | `{{EMOTIONAL_OPEN}}` |
| emotional_state_at_close | `{{EMOTIONAL_CLOSE}}` |
| arc_description | `{{ARC_DESCRIPTION}}` |
| editing_directives (joined) | `{{EDITING_DIRECTIVES}}` |
| line_by_line (aggregated) | `{{LINE_BY_LINE}}` |
