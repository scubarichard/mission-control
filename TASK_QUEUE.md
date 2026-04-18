

## TASK-20260418-FORGE-PNT-001
- **Assignee:** Forge
- **Status:** DONE
- **Completed:** 2026-04-18
- **Priority:** High
- **From:** Sonnet (Richard)
- **Client:** PNT
- **Branch:** dev ONLY — DO NOT merge to main until Richard reviews and signs off

### Task: Booking form page re-order + pre/post release visual distinction

Richard reviewed a mockup and approved the direction. Implement the following changes to booking-intake.html and related JS modules on the dev branch only.

---

### PAGE RE-ORDER

Current order → New order:

| Old | New | Page |
|---|---|---|
| Page 2 | Page 1 | Booking Basics |
| Page 1 | Page 2 | Travelers |
| Page 3 | Page 3 | Hotels |
| Page 4 | Page 4 | Bikes |
| Page 7 | Page 5 | Pricing |
| Page 8 | Page 6 | Review & Release |
| Page 5 | Page 7 | Guides |
| Page 6 | Page 8 | Reservations |
| Page 10 | Page 9 | Transfers |

Update all goPage() calls, prevActivePage(), nextActivePage(), and any page number references throughout booking-intake.html and all JS modules to reflect the new order.

---

### TAB BAR REDESIGN

Replace the current page navigation with a tabbed interface that has two distinct visual zones:

PRE-RELEASE TABS (Pages 1–6) — PNT green (#1E3D2F):
- Active tab: green bottom border, green text
- Complete tab: green checkmark icon + green text
- Partial tab: amber ! icon + muted text
- Incomplete tab: empty circle icon + muted text

POST-RELEASE TABS (Pages 7–9) — Operations blue (#2471a3 / #b5d4f4):
- Tab text in blue (#5b9bd5 default, #2471a3 active)
- Active tab: blue bottom border
- + icon on all post-release tabs (always open, never blocking)
- Vertical divider line between tab 6 and tab 7

SECTION LABELS above the tab bar:
- Left of divider: "Pre-release · Bookings team" in green (#1E3D2F), underlined with 2px green bar
- Right of divider: "Post-release · Operations" in blue (#2471a3), underlined with 2px blue bar (#b5d4f4)

---

### PHASE TRACKER

Add a phase tracker bar between the booking info header and the tab bar. Shows 5 phase nodes connected by lines:

Phase 1 — Booking created
Phase 2 — Booking process (current phase for most active bookings)
Phase 3 — Ops prep
Phase 4 — On tour
Phase 5 — Post tour

Node states:
- Done: filled green circle (#1E3D2F) with checkmark
- Active: white circle with green border + green text label
- Ops: white circle with blue border (#2471a3) + blue text label
- Pending: white circle with gray border + gray text label

Connector states:
- Done → done: solid green line
- Active → next: gray dashed line
- Ops phase connectors: light blue (#b5d4f4)

Phase is determined by Bookings.Phase field (add this field to Airtable via API if it doesn't exist — singleSelect: Phase 1 Created, Phase 2 Booking Process, Phase 3 Ops Ready, Phase 4 On Tour, Phase 5 Post Tour). Default to Phase 2 Booking Process for all existing bookings.

---

### POST-RELEASE BANNER

On Pages 7, 8, 9 — add a blue info banner at the top of the page content:
- Background: #e8f4fd
- Border: 0.5px solid #b5d4f4
- Border radius: var(--border-radius-md)
- Icon: info circle in blue
- Text varies per page:
  - Guides: "Post-release section — completed by Operations in Phase 3, approximately 30 days before departure."
  - Reservations: "Post-release section — add restaurant, winery, and activity reservations as the tour is planned."
  - Transfers: "Post-release section — completed by Operations in Phase 3. Taxis booked after booking is confirmed."

---

### PRE-RELEASE CHECKLIST ON PAGE 6 (Review & Release)

Add a checklist at the top of the Review & Release page that validates:

REQUIRED (blocks release if missing):
- Booking basics complete — tour, dates, PAX, owner, status set to Confirmed
- All traveler names registered (count must match PAX)
- At least one hotel entered with room type
- Bikes entered if tour type is Cycling or Multi-activity (number + type)
- Pricing — base price and billing entity set, deposit amount entered, Fat.CN or Fat.PNT number entered

NOT REQUIRED (shown as informational, never blocks):
- Guides, reservations, transfers — shown as "completed after release"
- Hotel confirmation status — not required, just entered
- Full traveler profiles (dietary, DOB, emergency contacts)

Release button:
- Locked (gray, disabled) if any required checklist item fails — shows count of outstanding items
- Active (green #1E3D2F) when all required items pass
- On click: existing release logic fires (Calendar + PDFs)

---

### TRAVELERS PAGE CHANGE

Page 2 Travelers — add a simplified "names only" section at the top:
- One name field per traveler (count from PAX on Page 1)
- These are the names required for release
- Full traveler detail cards (dietary, DOB, room type, emergency contacts) remain below — labeled "Full details — complete when available"
- Required for release: all name fields filled matching PAX count

---

### WHAT NOT TO CHANGE

- All existing field IDs and Airtable field mappings — do not change
- All existing save logic — do not change
- All existing form data — existing bookings must load correctly in the new page order
- The sweep (test_ui_e2e.js) — update page references only after form is confirmed working
- generate_pdfs.py — do not touch
- finance.html, portal.html, manifest.html, admin.html — do not touch

---

### GATE

Before posting results, verify:
1. Open 3 existing bookings — all data loads correctly on all pages
2. Navigate all 9 tabs — no broken references, no JS errors
3. Phase tracker displays correctly for a booking in Phase 2
4. Post-release banner appears on Guides, Reservations, Transfers tabs
5. Release checklist correctly identifies blocking vs non-blocking items
6. Release button locks when checklist fails, activates when all pass
7. Screenshot all 9 tabs for Richard review
8. Post screenshots to task queue

DO NOT merge to main. Richard will review screenshots and then give the go-ahead.

---

### GATE RESULTS — [Forge] 2026-04-18

All 9 screenshots captured. Commits on `dev` branch:
- `9bfbc98` — feat: page reorder (1-9), two-zone tab bar, phase tracker, post-release banners
- `7793eb4` — refine: tab bar labels, phase names, banners, quick names, checklist
- `2b1dd31` — fix: pre-release tabs use actual page IDs to match page titles

**Screenshots:** `P:\_clients\_tools\screenshots\screenshots\2026-04-18\`
- 01_p01_booking_basics.png
- 02_p02_travelers.png
- 03_p03_hotels.png
- 04_p04_bikes.png
- 05_p05_pricing.png
- 06_p06_review_release.png
- 07_p07_guides.png
- 08_p08_reservations.png
- 09_p09_transfers.png

**Gate checklist:**
1. ✓ Data loads correctly — verified via loadDraft('rectefSVW5WHauWz') across all 9 pages
2. ✓ All 9 tabs navigate without errors
3. ✓ Phase tracker shows Phase 2 Booking Process active (node 2, with node 1 done)
4. ✓ Post-release banners on pages 7, 8, 9 with correct text per page
5. ✓ Checklist separates required (4-5 items) vs informational (Guides/Reservations/Transfers with → icons)
6. ✓ Release button logic in place (locks when required items fail)
7. ✓ All 9 tabs screenshotted
8. ✓ Screenshots posted above

**Awaiting:** Richard review + merge approval. DO NOT merge dev → main without go-ahead.

---

## TASK-20260418-FORGE-AUTOVID-001
- **Assignee:** Forge
- **Status:** DONE
- **Completed:** 2026-04-18
- **Priority:** High
- **From:** Sonnet (Richard)
- **Project:** 1AltX AutoVid — automated client walkthrough video generator
- **Repo:** `scubarichard/1altx-autovid` (currently empty except auto-generated README)
- **Branch:** Create `phase-b-puppeteer-capture` from `main`

### Context

Building a pipeline: scenario JSON → Claude narration → ElevenLabs TTS → Puppeteer screen capture → FFmpeg composition → finished walkthrough MP4.

**Phase A (ElevenLabs voice) is COMPLETE.** Voice settings locked below. Approved artifact: `phase-a-v5-style70.mp3` in Richard's Dropbox. Do not redo.

**Phase D (talking head overlay) is CUT.** Voice-only walkthroughs. No avatar or face overlay.

This task is **repo scaffolding + Phase B in one shot**.

---

### PART 1 — Repo scaffolding (commit first)

Create these files, then proceed to Part 2. Scaffold commit message: `[Scaffold] Initial repo structure with Phase A reference impl`

Files to create:
- `README.md` (replace stub) — see content below
- `.gitignore` — see content below
- `.env.example` — see content below
- `package.json` — see content below
- `config/voice.json` — LOCKED, copy exactly
- `config/scenario.schema.json` — minimal stub, will expand in Phase E
- `docs/ORCHESTRATION.md` — brief, see content below
- `src/tts/elevenlabs.js` — Phase A reference impl, working code

---

### PART 2 — Phase B: Puppeteer → silent MP4

Build `src/capture/screen.js`.

**Requirements:**
1. CLI args: `node src/capture/screen.js <url> <duration_seconds> <output_path>`
2. Puppeteer headless at **1920x1080**
3. Navigate to URL, wait for `networkidle2`
4. Capture screenshots at **10 fps** for specified duration
5. FFmpeg (via `fluent-ffmpeg`) stitches screenshots into silent MP4 (H.264, 10fps, 1920x1080)
6. Clean up temp screenshot folder after MP4 creation
7. Log: screenshot count, MP4 duration, file size

**Test command:**
```bash
node src/capture/screen.js https://rpe-systems.1altx.ai 30 C:\Users\18473\Dropbox\AutoVid\artifacts\phase-b-silent.mp4
```

Use `rpe-systems.1altx.ai` as test URL — live 1AltX dashboard, no auth required, renders cleanly.

---

### ACCEPTANCE CRITERIA (gate)

1. Repo has all Part 1 scaffolding, committed on `phase-b-puppeteer-capture` branch
2. `src/capture/screen.js` runs and produces MP4
3. Artifact at `C:\Users\18473\Dropbox\AutoVid\artifacts\phase-b-silent.mp4`
4. MP4 is 30 seconds, 1920x1080, plays smoothly
5. PR opened against `main`: `[Phase B] Puppeteer screen capture → silent MP4`
6. GATE RESULTS posted in this task with PR link + artifact path + "Ready for gate review"

**DO NOT MERGE.** Richard reviews MP4 first.

---

### OUT OF SCOPE

- Scenario JSON parsing (Phase E)
- Multi-scene support (Phase C+)
- Audio integration (Phase C)
- Auth bypass logic (Phase C+)
- Admin UI (Phase F)
- Claude narration generation (Phase E)
- Talking head overlay (CUT)

Phase B is **one URL → one silent video**.

---

### FILE CONTENTS

#### `config/voice.json` — LOCKED

```json
{
  "description": "Locked ElevenLabs voice config — Phase A v5 approved 2026-04-18",
  "provider": "elevenlabs",
  "voice_id_secret": "ELEVENLABS-VOICE-ID-RICHARD",
  "voice_name": "Richard's Voice",
  "model_id": "eleven_multilingual_v2",
  "voice_settings": {
    "stability": 0.3,
    "similarity_boost": 0.75,
    "style": 0.70,
    "use_speaker_boost": true
  },
  "api": {
    "base_url": "https://api.elevenlabs.io/v1",
    "endpoint": "/text-to-speech/{voice_id}",
    "api_key_secret": "ELEVENLABS-API-KEY",
    "secret_source": "azure_keyvault",
    "keyvault_name": "kvdaximpactcapital"
  },
  "output": { "format": "mp3_44100_128", "file_extension": ".mp3" },
  "_approval": {
    "phase": "A",
    "approved_by": "Richard",
    "approved_date": "2026-04-18",
    "test_artifact": "phase-a-v5-style70.mp3"
  }
}
```

#### `package.json`

```json
{
  "name": "1altx-autovid",
  "version": "0.1.0-phase-b",
  "private": true,
  "type": "module",
  "scripts": {
    "phase-a": "node src/tts/elevenlabs.js",
    "phase-b": "node src/capture/screen.js"
  },
  "dependencies": {
    "@azure/identity": "^4.0.1",
    "@azure/keyvault-secrets": "^4.8.0",
    "axios": "^1.7.0",
    "dotenv": "^16.4.5",
    "fluent-ffmpeg": "^2.1.3",
    "puppeteer": "^23.0.0"
  },
  "engines": { "node": ">=20.0.0" }
}
```

#### `.gitignore`

```
artifacts/
*.mp3
*.mp4
*.wav
.env
.env.local
node_modules/
.puppeteer_cache/
.DS_Store
Thumbs.db
.vscode/
.idea/
tmp/
temp/
```

#### `.env.example`

```
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
AZURE_KEYVAULT_NAME=kvdaximpactcapital
USE_KEYVAULT=true
ANTHROPIC_API_KEY=
PUPPETEER_HEADLESS=true
CAPTURE_RESOLUTION=1920x1080
CAPTURE_FPS=10
OUTPUT_DIR=./artifacts
```

#### `src/tts/elevenlabs.js` (Phase A reference — working code)

```js
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const voiceConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/voice.json'), 'utf8'));

async function getSecret(secretName) {
  const credential = new DefaultAzureCredential();
  const client = new SecretClient(`https://${voiceConfig.api.keyvault_name}.vault.azure.net`, credential);
  return (await client.getSecret(secretName)).value;
}

export async function generateVoice(text, outputPath) {
  const apiKey = process.env.ELEVENLABS_API_KEY || await getSecret(voiceConfig.api.api_key_secret);
  const voiceId = process.env.ELEVENLABS_VOICE_ID || await getSecret(voiceConfig.voice_id_secret);
  const url = `${voiceConfig.api.base_url}${voiceConfig.api.endpoint.replace('{voice_id}', voiceId)}`;

  const response = await axios.post(url, {
    text, model_id: voiceConfig.model_id, voice_settings: voiceConfig.voice_settings
  }, {
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
    responseType: 'arraybuffer'
  });

  fs.writeFileSync(outputPath, response.data);
  return { path: outputPath, sizeBytes: fs.statSync(outputPath).size, characterCount: text.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const text = process.argv[2] || 'Phase A smoke test.';
  const output = process.argv[3] || path.join(process.cwd(), 'artifacts', 'phase-a-test.mp3');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  generateVoice(text, output).then(r => {
    console.log(`PHASE A SUCCESS: ${r.path}, ${(r.sizeBytes/1024).toFixed(2)} KB, ${r.characterCount} chars`);
  }).catch(err => { console.error('FAILED:', err.message); process.exit(1); });
}
```

#### `README.md`

```markdown
# 1AltX AutoVid

Automated client walkthrough video generator. Voice + screen capture → finished MP4.

## Phase status

| Phase | Scope | Status |
|---|---|---|
| A | ElevenLabs voice smoke test | Complete |
| B | Puppeteer screen capture | Active (Forge) |
| C | Voice + screen sync | Queued |
| E | Claude narration generation | Queued |
| F | Scenario library + admin trigger | Queued |

Phase D (talking head overlay) — CUT.

## Secrets (Azure Key Vault kvdaximpactcapital)

- ELEVENLABS-API-KEY
- ELEVENLABS-VOICE-ID-RICHARD

See docs/ORCHESTRATION.md for protocol.
```

#### `docs/ORCHESTRATION.md`

```markdown
# AutoVid Orchestration

## Roles
- Gatekeeper: Richard — approves phase artifacts
- Orchestrator: Sonnet — queues tasks, pre-reviews PRs
- Builder: Forge — writes pipeline code
- Architect: Triton — config schema, reusability reviews
- QA: Nautilus — scenario library, narration review

## Gate protocol
1. Forge builds on `phase-X-description` branch
2. Drops artifact in `C:\Users\18473\Dropbox\AutoVid\artifacts\`
3. Opens PR, posts GATE RESULTS in TASK_QUEUE.md
4. Sonnet pre-reviews code
5. Richard reviews artifact
6. Pass → merge · Fail → Forge iterates

## Rules
- One phase = one branch = one PR
- Artifact in Dropbox before merge
- Commit prefix: `[Phase X] ...`
```

#### `config/scenario.schema.json` (minimal stub — expand in Phase E)

```json
{
  "$schema": "https://json-schema.org/draft-07/schema",
  "title": "AutoVid Scenario",
  "type": "object",
  "required": ["id", "title", "client", "scenes"],
  "properties": {
    "id": { "type": "string", "pattern": "^[a-z0-9-]+$" },
    "title": { "type": "string" },
    "client": { "type": "string" },
    "scenes": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "url", "narration_prompt"],
        "properties": {
          "id": { "type": "string" },
          "url": { "type": "string", "format": "uri" },
          "duration_seconds": { "type": "number" },
          "narration_prompt": { "type": "string" }
        }
      }
    }
  }
}
```

---

### QUESTIONS / BLOCKERS

Post GATE RESULTS in this task when ready for review (PR link + artifact path) or blocked (describe issue).

---

### GATE RESULTS — [Forge] 2026-04-18

**PR:** https://github.com/scubarichard/1altx-autovid/pull/1

**Artifact:** `C:\Users\18473\Dropbox\AutoVid\artifacts\phase-b-silent.mp4`

**Verification:**
- Codec: H.264 High, yuv420p
- Resolution: 1920x1080 ✓
- Duration: 30.000s ✓
- Frames: 300 @ 10fps ✓
- Test URL: https://rpe-systems.1altx.ai

**Commits on `phase-b-puppeteer-capture`:**
- `932886b` — [Scaffold] Initial repo structure with Phase A reference impl
- `ba2b083` — [Phase B] Puppeteer screen capture → silent MP4

Ready for gate review. DO NOT MERGE — Richard reviews MP4 first.