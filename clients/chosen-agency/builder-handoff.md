# BUILDER HANDOFF — CONTENT MACHINE AUTOMATED SYSTEM

**Source:** Erika Cobb, Chosen Agency
**Received:** 2026-04-28
**Format:** Original PDF rendered as markdown for repo searchability

---

## Project Goal

Build a production-ready AI content pipeline from queued row → Script Doc → Editor Brief → ElevenLabs audio → HeyGen avatar video → editor-ready package.

## Required V1 Stack

Google Sheets, Google Docs, Google Drive, Make.com, OpenAI, ElevenLabs, HeyGen.

## Source of Truth

Google Sheets only. Notion is optional V1.

## Required Build Window

7–14 days with phased delivery and live end-to-end testing.

## Completion Standard

The system is accepted only when a non-technical operator can run it without builder intervention.

---

## 1. Executive Summary

Automated content production engine. Receives structured content inputs, generates production assets automatically, routes work to editors, supports QA review, records performance.

V1 deliverable: working end-to-end pipeline that starts with a queued row in Google Sheets and ends with a ready-to-edit AI avatar video package containing Script Document, Editor Brief, ElevenLabs audio, Raw Video Link, and updated system status.

### Core Outcomes Required

- Non-technical operator can enter one row of structured data and trigger by setting Status = Queued
- Make.com validates the row, generates documents, triggers AI outputs, stores links, updates statuses without manual copy/paste
- The editor receives everything needed to begin work immediately
- Team can later track QA, testing, winners, editor performance

### End-to-End Flow

INPUT → Strategist enters row, Status = Queued
TRIGGER → Make.com detects, validates, locks row to Processing
PIPELINE:
  [1] OpenAI: Generate Script, Caption, Editor Brief
  [2] Google Docs: Create Script Doc, Editor Brief Doc
  [3] ElevenLabs: Convert Script → Voice → Audio File URL
  [4] HeyGen: Generate Avatar Video → Video URL or Render Job ID
HANDOFF → System writes Script Doc Link, Brief Doc Link, Voice File URL, Raw Video Link, Variation ID, Status = Ready for Editing
EDITOR (Manual): CapCut/Premiere editing, captions, music, optimization
FINAL → High-quality finished video ready for posting

### Critical Rules

**Automation Boundary:**
- Above Ready for Editing = automated
- After Ready for Editing = human/editor

**Editor Must Never:**
- Use ElevenLabs manually
- Use HeyGen manually
- Generate scripts outside the system

**System Must:**
- Run end-to-end with one trigger
- Require zero manual API interaction
- Return all links to the sheet
- Always end at Ready for Editing

---

## 2. Scope

### In Scope

- Google Sheets operational backend
- Google Docs templates for Script Doc and Editor Brief
- Google Drive folder structure
- Make scenarios (core + approved advanced)
- OpenAI, ElevenLabs, HeyGen API integration
- Status logic, error handling, unique IDs, traceability
- Optional Notion team interface
- Testing, documentation, handoff

### Out of Scope (unless approved)

- Manual video editing
- Paid ads dashboards
- Custom-coded web apps
- Public front-end portals

### Configuration Rules — Do Not Hardcode

**Non-Negotiable:** All adjustable creative settings must be controlled from Google Sheets, not buried inside Make modules.

**Must Not Hardcode:**
- Voice ID, Avatar ID
- ElevenLabs voice settings
- Tone or delivery settings
- Speed settings

**Required Architecture:**
1. System Settings tab in Sheets (global defaults)
2. Per-row override columns in Production Tracker

**Required Make Logic:**
```
If row override exists → use row override
Else → use global default from System Settings
```

### What May Be Hardcoded

Scenario structure, status routing, validation rules, sheet names, column mappings, folder destinations, error-handling logic.

### What May NOT Be Hardcoded

Voice ID, Avatar ID, voice tuning values, tone/delivery settings, anything likely to need future creative optimization.

### Required Live Test (Configuration)

1. Default Voice ID + Avatar ID run produces video
2. Change global Default Voice ID — new row uses new default automatically
3. Single row override uses different value without changing global default
4. Clear override — fallback to global default works

---

## 3. System Settings Tab Schema

**Tab Name:** System Settings

**Columns:** Setting Type | Setting Name | Value | Notes | Active

### Voice Settings
| Setting Type | Setting Name | Example | Active |
|---|---|---|---|
| Voice | Default Voice ID | voice_erika_main | TRUE |
| Voice | Default ElevenLabs Model ID | eleven_multilingual_v2 | TRUE |
| Voice | Default Stability | 0.35 | TRUE |
| Voice | Default Similarity Boost | 0.75 | TRUE |
| Voice | Default Style | 0.60 | TRUE |
| Voice | Default Speaker Boost | TRUE | TRUE |

### Avatar Settings
| Setting Type | Setting Name | Example | Active |
|---|---|---|---|
| Avatar | Default Avatar ID | avatar_erika_main | TRUE |
| Avatar | Default Avatar Background | studio_white | TRUE |
| Avatar | Default Delivery Style | confident | TRUE |
| Avatar | Default Playback Speed | 1.0 | TRUE |

### Prompt / Delivery Settings
| Setting Type | Setting Name | Example | Active |
|---|---|---|---|
| Prompt | Default Tone | bold_direct | TRUE |
| Prompt | Default Emotional Delivery | urgency_confident | TRUE |
| Prompt | Default Output Language | en | TRUE |

---

## 4. Production Tracker Override Columns

| Column | Type |
|---|---|
| Override Voice ID | Text |
| Override Avatar ID | Text |
| Override Tone | Text/Select |
| Override ElevenLabs Model ID | Text |
| Override ElevenLabs Stability | Number |
| Override ElevenLabs Similarity Boost | Number |
| Override ElevenLabs Style | Number |
| Override ElevenLabs Speaker Boost | TRUE/FALSE |
| Override Avatar Background | Text/Select |
| Override Delivery Style | Text/Select |
| Override Playback Speed | Number |
| Override Emotional Delivery | Text/Select |

---

## 5. Production Tracker Schema (Section 6.1)

| Column | Required | Purpose |
|---|---|---|
| Status | Yes | Primary trigger and workflow state |
| Script ID | Yes | Permanent script identifier |
| Script Name | Yes | Human-readable asset name |
| Variation Number | Yes | Version number within script |
| Variation ID | System | Unique key for output record |
| Avatar ID | Yes | HeyGen avatar selector |
| Voice ID | Yes | ElevenLabs voice reference |
| Audience | Yes | Target audience summary |
| Current Belief | Yes | Current audience belief |
| Desired Belief | Yes | Desired audience belief |
| Tone | Yes | Content tone |
| Emotional Arc | Yes | Emotional movement target |
| Offer / CTA | Yes | Call to action / offer |
| Script Text | Yes | Primary script body |
| Caption Text | Recommended | Final caption output |
| Script Doc Link | System | Generated script doc URL |
| Brief Doc Link | System | Generated editor brief URL |
| Voice File URL | System | Audio asset URL |
| Raw Video Link | System | Raw AI video URL |
| Render Job ID | System | Async video job reference |
| Assigned Editor | System/Manual | Owner of editing task |
| Edited Video Link | Later | Final edited video output |
| QA Status | Later | Pending / Approved / Revisions Needed |
| Publish Status | Later | Not Posted / Scheduled / Posted |
| Error Message | System | Human-readable failure log |
| Created Date | Recommended | Audit trail |
| Last Updated | System | Last row update timestamp |
| Row ID | Recommended | Internal row tracking key |

### Required Status Values

- Queued
- Processing
- Rendering
- Ready for Editing
- Editing
- Ready for QA
- Done
- Error

---

## 6. Google Docs Templates

### Script Doc Template Fields
- Script ID
- Script Name
- Audience
- Offer / CTA
- Script Text

### Editor Brief Template — FIXED SECTION ORDER (THIS IS PRIORITY)

The brief MUST always keep this fixed section order:

1. **Review Priorities**
2. **Customer Avatar and Emotional Arc**
3. **Editing Directives**
4. **Line-by-Line Visual Direction**

**Erika's stated priority:** "very impressed with the detailed editing brief shown in this video. That's important." This section is the highest-leverage piece of V1 quality.

### Drive Folder Structure (already created in Chosen Agency Drive)

- 00_Test_Archive
- 01_Production_Tracker_Backend
- 02_Script_Docs
- 03_Editor_Briefs
- 04_Raw_AI_Videos
- 05_ElevenLabs_Audio
- 06_Edited_Videos
- 07_QA_Review
- 08_B-Roll_Library
- 09_Templates
- 10_Documentation

---

## 7. Build Phases (per SOW Section 8)

| Phase | Days | Goal |
|---|---|---|
| 1 | 1–2 | Backend foundation: workbook, tabs, statuses, templates, folder structure |
| 2 | 3–5 | Core text/doc automation: OpenAI generation, Script Doc, Editor Brief |
| 3 | 5–8 | Audio + video generation: ElevenLabs, HeyGen, write-back |
| 4 | 8–10 | Hardening + async handling: Render checker, error handling, logs |
| 5 | 10–12 | Visibility layer: Notion sync if approved |
| 6 | 12–14 | Acceptance + handoff: Tests, Looms, documentation, manager SOP |

---

## 8. API Specs

### OpenAI
- **Purpose:** script, caption, editor brief, hook/angle, classification
- **Auth:** native Make connection or `Authorization: Bearer YOUR_OPENAI_API_KEY`
- **Rule:** Force structured output where practical

### ElevenLabs (Mandatory V1)
- **Purpose:** generate voice/audio from script
- **Auth header:** `xi-api-key`
- **Approved voice IDs, model ID, voice settings** must come from owner

### HeyGen
- **Purpose:** generate raw avatar video
- **Auth header:** `X-API-KEY`
- **Async handling required** if video generation returns Render Job ID

**Required HeyGen payload baseline:**
```json
{
  "avatar_id": "{{Avatar ID}}",
  "voice_id": "{{Voice ID}}",
  "script": "{{Script Text}}",
  "title": "{{Variation ID}}"
}
```

### API Security Rules

- Store API keys only inside Make connections or secured HTTP headers
- Never hardcode keys into Sheets, Docs, or Notion
- Document which scenario uses which key and endpoint
- Deliver a credential map to the owner

---

## 9. Phase 2+ Advanced Scenarios

These should ONLY be implemented after the core system is fully built, tested, and stable.

1. Sheets → Notion Production Tracker Sync
2. Sheets → Notion Editor Scorecard Sync
3. Sheets → Notion Content Testing Sync
4. Sheets → Notion B-Roll Library Sync
5. Script Generator
6. AI Performance Classifier
7. Winner Auto-Promotion
8. Winner Clone Generator
9. Editor Performance Bonus Calculator
10. Editor Bonus Progress Dashboard / Alert System
11. Monthly Bonus Summary Generator

---

## 10. Required Builder Test Cases (Section 13)

| Test | Action | Pass Condition |
|---|---|---|
| Happy path | Insert complete row, Status = Queued | All docs/audio/video/statuses update successfully |
| Missing data | Queue incomplete row | Filter blocks run, no junk assets created |
| API error | Force one API to fail | Row captures Error Message, Status = Error |
| Async render | Use HeyGen async flow | Render checker updates final URL, moves to Ready for Editing |
| Duplicate prevention | Run update-safe sync on existing record | No duplicate output records |

---

## 11. Builder Deliverables (Section 14)

- Configured Google Sheet backend with all tabs
- Configured Google Docs templates
- Configured Drive folder structure
- All Make scenarios in approved phase scope
- All API connections configured securely
- Field map: every source column → destination property
- Credential map: where every key is stored
- Loom walkthrough of full system
- Loom walkthrough of every core scenario
- Written operating guide for non-technical manager
- Written troubleshooting section for common errors
- At least one preserved test row for reference

---

## 12. Common Failure Points to Prevent (Section 15)

- Blank/incomplete rows triggering scenarios (filters not strict enough)
- Missing unique IDs causing duplicate output records
- Field type mismatches between Sheets, Make, Notion
- Status logic allowing accidental re-processing
- Silent API failures with no error message write-back
- Broken Drive permissions preventing Docs from opening
- Returning HeyGen job ID without implementing render checker
- Using Notion Person properties too early
- Storing API keys outside Make connections

---

## 13. Final Acceptance (Section 18)

System is complete only when:

- One queued row produces complete editor-ready package
- OpenAI + ElevenLabs + HeyGen all live in V1
- Error handling writes back meaningful messages
- No manual copy/paste between systems
- Drive and Docs links open for the team
- Status model works exactly as specified
- Builder delivered documentation, Looms, field map, credential map, preserved test row
- Owner confirms system is understandable and usable by non-technical operator

---

## Notes for Forge

**High-leverage piece per Erika:** The Editor Brief generation. She specifically referenced the inspiration Loom (Loom share/e8fb5f0138294b088f7190acc705c7f2) and said "very impressed with the detailed editing brief shown in this video. That's important."

**4-section Editor Brief structure is non-negotiable.** Section names cannot change without Erika's approval.

**System Settings + Override pattern is non-negotiable.** Voice/avatar/delivery values cannot be hardcoded inside Make.

**Editor stage is manual.** Builder responsibility ends at Status = Ready for Editing.

**Approved OpenAI model:** Working assumption is `gpt-4o`. Awaiting Erika confirmation (sent kickoff Apr 28). Confirm before going to production.
