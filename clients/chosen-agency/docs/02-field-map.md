# Chosen Agency Content Pipeline V1 — Field Map

**Version:** 1.0  
**Last Updated:** 2026-05-04

This document maps every field through the pipeline: where data originates, how it's transformed, and where it lands.

---

## V1 Sheet Schema (Queue Tab)

| Col | Position | Field Name | Type | Source | Used By |
|---|---|---|---|---|---|
| A | 0 | Status | dropdown | Operator + Pipeline | Module 1 filter, all status updates |
| B | 1 | Script ID | text | Operator | Variation ID generation, doc names |
| C | 2 | Script Name | text | Operator | Doc names, OpenAI prompt |
| D | 3 | Variation Number | int | Operator | Variation ID generation |
| E | 4 | Variation ID | text | Pipeline (auto) | Tracking, deduplication |
| F | 5 | Avatar ID | text | Operator (optional) | Module 2 fallback chain |
| G | 6 | Voice ID | text | Operator (optional) | Module 2 fallback chain |
| H | 7 | Audience | text | Operator | OpenAI script + brief prompts |
| I | 8 | Current Belief | text | Operator | OpenAI prompts |
| J | 9 | Desired Belief | text | Operator | OpenAI prompts |
| K | 10 | Tone | text | Operator | OpenAI prompts (with override) |
| L | 11 | Emotional Arc | text | Operator | OpenAI prompts |
| M | 12 | Offer / CTA | text | Operator | OpenAI prompts |
| N | 13 | Script Text | long text | Pipeline (Module 6) | Output for review |
| O | 14 | Caption Text | long text | Pipeline (Module 6) | Output for social posting |
| P | 15 | Override Voice ID | text | Operator (optional) | Module 2 first priority |
| Q | 16 | Override Avatar ID | text | Operator (optional) | Module 2 first priority |
| R | 17 | Override Tone | text | Operator (optional) | OpenAI prompts |
| S | 18 | Override ElevenLabs Stability | float | Operator (optional) | (Phase 2 — V1.5 architecture skips ElevenLabs) |
| T | 19 | Override ElevenLabs Similarity Boost | float | Operator (optional) | (Phase 2 — V1.5 architecture skips ElevenLabs) |
| U | 20 | Script Doc Link | URL | Pipeline (Module 6) | Editor handoff |
| V | 21 | Brief Doc Link | URL | Pipeline (Module 6) | Editor handoff |
| W | 22 | Voice File URL | URL | Pipeline (Module 9) — DEPRECATED in V1.5 | Editor handoff (legacy) |
| X | 23 | Raw Video Link | URL | Pipeline (Module 16) | Editor handoff |
| Y | 24 | Render Job ID | text | Pipeline (Module 10) | Polling, Render Checker |
| Z | 25 | Assigned Editor | text | Operator (optional) | Editor routing |
| AA | 26 | Error Message | text | Pipeline (Modules 17, RC) | Troubleshooting |
| AB | 27 | Last Updated | datetime | Pipeline (every status change) | Audit trail |

**Critical:** When referencing the trigger row in Make formulas, use **0-indexed positions in backticks**: `{{1.\`1\`}}` for Script ID, `{{1.\`13\`}}` for Script Text, etc. Do NOT use header names like `{{1.Script ID}}` — Make's filterRows v2 returns positional keys.

---

## Module-by-Module Data Flow

### Module 1 — Trigger (google-sheets:filterRows)

- **Input:** Sheet `Content_Pipeline` → tab `Queue`
- **Filter:** column `A` = `Queued`
- **Output:** all 28 columns as positional keys (0-19, plus `__ROW_NUMBER__`)
- **Limit:** 1 (process one row per run)

### Module 2 — Set Variables (builtin:SetVariables)

| Variable | Value | Purpose |
|---|---|---|
| `effective_voice_id` | `ifempty(ifempty(1.\`15\`; 1.\`6\`); "IuxDTLynYdvisya7jrK5")` | (V1.5: unused since text mode) |
| `effective_avatar_id` | `ifempty(ifempty(1.\`16\`; 1.\`5\`); "Tyler-incasualsuit-20220721")` | HeyGen avatar with fallback chain |
| `variation_id` | `if(1.\`4\`; 1.\`4\`; 1.\`1\` + "_v" + 1.\`3\` + "_" + formatDate(now;"YYYYMMDDHHmmss"))` | Unique tracking ID |
| `openai_model` | `gpt-4o` | OpenAI model selection |
| `is_done` | `false` | Polling loop control flag |

### Module 4 — Status → Processing (google-sheets:updateRow)

- Writes back to row __ROW_NUMBER__
- Sets: Status = `Processing`, Last Updated = now

### Module 5 — OpenAI Script + Caption (openai:CreateCompletion)

- **Model:** {{2.openai_model}} (= gpt-4o)
- **Temperature:** 0.7
- **Max Tokens:** 2000
- **Response Format:** json_object
- **System Prompt:** Includes SSML break tag instructions for HeyGen pacing
- **User Prompt Inputs:** Script Name, Audience, Current Belief, Desired Belief, Tone (with Override), Emotional Arc, Offer/CTA
- **Output:** JSON `{ "script": "...", "caption": "..." }`

### Module 29 — Parse JSON

- Parses Module 5's output into accessible fields: `{{29.script}}`, `{{29.caption}}`

### Module 23 — OpenAI Editor Brief (openai:CreateCompletion)

- Same model/settings as Module 5
- **Inputs:** All brief context + the generated script
- **Output:** JSON with editing_directives, b_roll_suggestions, music_recommendations, captions

### Module 30 — Parse JSON

- Parses Module 23's output

### Module 24 — Create Script Doc (google-docs:createADocumentFromTemplate)

- **Template:** Script Doc template
- **Folder:** 02_Script_Docs
- **Name:** `Script_{{1.\`1\`}}_v{{1.\`3\`}}_{{formatDate(now;"YYYYMMDD")}}`
- **Placeholders Filled:** SCRIPT_ID, SCRIPT_NAME, VARIATION_NUMBER, VARIATION_ID, AUDIENCE, OFFER_CTA, SCRIPT_TEXT, CAPTION_TEXT, plus belief fields, emotional arc, tone, last updated
- **Output:** Doc with `id`, `webViewLink`, `name`, etc.

### Module 25 — Create Editor Brief Doc (google-docs:createADocumentFromTemplate)

- **Template:** Editor Brief Doc template
- **Folder:** 03_Editor_Briefs
- Same naming convention as Script Doc, suffix `_brief`
- **Placeholders:** From Module 30's parsed brief output

### Module 6 — Status → Script Done (google-sheets:updateRow)

- Sets: Status = `Script Done`, Script Text, Caption Text, Script Doc Link = `{{24.webViewLink}}`, Brief Doc Link = `{{25.webViewLink}}`, Last Updated

### Modules 7, 8, 9 — DISABLED in V1.5

- Module 7 (ElevenLabs direct TTS): disabled — HeyGen handles TTS in text mode
- Module 8 (Drive upload audio): disabled
- Module 9 (Status → Voice Done): disabled

### Module 10 — HeyGen Create Video (HTTP POST)

- **URL:** `https://api.heygen.com/v2/video/generate`
- **Auth:** X-Api-Key header
- **Body:**
  ```json
  {
    "video_inputs": [{
      "character": { "type": "avatar", "avatar_id": "{{2.effective_avatar_id}}", "avatar_style": "normal" },
      "voice": { "type": "text", "input_text": "{{29.script}}", "voice_id": "<HeyGen-linked-voice-id>" }
    }],
    "dimension": { "width": 1280, "height": 720 }
  }
  ```
- **Output:** `data.video_id`

### Module 11 — Status → Rendering + save video_id (google-sheets:updateRow)

- Sets: Status = `Rendering`, Render Job ID = `{{10.data.video_id}}`, Last Updated

### Module 12 — Repeater (builtin:Repeater)

- **Iterations:** 40
- **Step:** 1, **Start:** 1
- Inner loop: poll HeyGen, sleep, increment

### Module 14 — HeyGen Status Check (HTTP GET)

- **URL:** `https://api.heygen.com/v1/video_status.get?video_id={{1.\`24\`}}`
- **Filter:** Skip if `{{is_done}} == "true"`

### Module 15 — Inner Router (builtin:BasicRouter)

3 routes based on `{{14.data.data.status}}`:

### Module 16 — Status → Done + save video URL (google-sheets:updateRow)

- **Filter:** `{{14.data.data.status}} == "completed"`
- Sets: Status = `Done`, Raw Video Link = `{{14.data.data.video_url}}`, Last Updated

### Module 21 — Mark done (completed)

- **Filter:** Same completion filter
- Sets `is_done = true` to break polling loop

### Module 17 — Status → Failed + save error (google-sheets:updateRow)

- **Filter:** `{{14.data.data.status}} == "failed"`
- Sets: Status = `Failed`, Error Message, Last Updated

### Module 22 — Mark done (failed)

- Sets `is_done = true`

### Module 13 — Sleep 30 seconds

- **Filter:** Status is processing/pending/waiting (still rendering)

### Module 18 — Update poll counter

- Increments visible iteration count for diagnostics

---

## Status Lifecycle

```
Queued
  → Processing (Module 4)
  → Script Done (Module 6) [Doc Links populated]
  → Rendering (Module 11) [Render Job ID populated]
  → Done (Module 16) [Raw Video Link populated]
  
or → Failed (Module 17) [Error Message populated]
or → Error (Render Checker) [if stuck >30 min and HeyGen API can't be reached]
```

---

## File Naming Conventions

- Script Docs: `Script_{Script ID}_v{Variation Number}_{YYYYMMDD}` (e.g., `Script_BLOG-2026-05-15_v1_20260515`)
- Editor Brief Docs: same pattern + `_brief`
- HeyGen videos: server-side IDs only (URL is the asset)

---

## Phase 2 Considerations

- Webhook conversion: replace inline polling with HeyGen callback (see followups.md)
- Multi-editor support: Assigned Editor column already in schema
- Notion sync: schema designed to round-trip with Notion CMS
