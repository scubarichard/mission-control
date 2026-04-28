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

7-14 days with phased delivery and live end-to-end testing.

## Completion Standard

The system is accepted only when a non-technical operator can run it without builder intervention.

---

## 1. Executive Summary

Automated content production engine. Receives structured content inputs, generates production assets automatically, routes work to editors, supports QA review, records performance.

V1 deliverable: working end-to-end pipeline that starts with a queued row in Google Sheets and ends with a ready-to-edit AI avatar video package containing Script Document, Editor Brief, ElevenLabs audio, Raw Video Link, and updated system status.

### Critical Rules

**Automation Boundary:**
- Above Ready for Editing = automated
- After Ready for Editing = human/editor

**System Must:**
- Run end-to-end with one trigger
- Require zero manual API interaction
- Return all links to the sheet
- Always end at Ready for Editing

---

## 2. Configuration Rules - Do Not Hardcode

**Non-Negotiable:** All adjustable creative settings must be controlled from Google Sheets, not buried inside Make modules.

**Must Not Hardcode:** Voice ID, Avatar ID, ElevenLabs voice settings, Tone or delivery settings, Speed settings.

**Required Architecture:**
1. System Settings tab in Sheets (global defaults)
2. Per-row override columns in Production Tracker

**Required Make Logic:**
```
If row override exists -> use row override
Else -> use global default from System Settings
```

---

## 3. System Settings Tab Schema

Tab Name: System Settings
Columns: Setting Type | Setting Name | Value | Notes | Active

### Voice Settings
| Setting Type | Setting Name | Example |
|---|---|---|
| Voice | Default Voice ID | voice_erika_main |
| Voice | Default ElevenLabs Model ID | eleven_multilingual_v2 |
| Voice | Default Stability | 0.35 |
| Voice | Default Similarity Boost | 0.75 |
| Voice | Default Style | 0.60 |
| Voice | Default Speaker Boost | TRUE |

### Avatar Settings
| Setting Type | Setting Name | Example |
|---|---|---|
| Avatar | Default Avatar ID | avatar_erika_main |
| Avatar | Default Avatar Background | studio_white |
| Avatar | Default Delivery Style | confident |
| Avatar | Default Playback Speed | 1.0 |

### Prompt / Delivery Settings
| Setting Type | Setting Name | Example |
|---|---|---|
| Prompt | Default Tone | bold_direct |
| Prompt | Default Emotional Delivery | urgency_confident |
| Prompt | Default Output Language | en |

---

## 4. Production Tracker Override Columns

Override Voice ID, Override Avatar ID, Override Tone, Override ElevenLabs Model ID, Override ElevenLabs Stability, Override ElevenLabs Similarity Boost, Override ElevenLabs Style, Override ElevenLabs Speaker Boost, Override Avatar Background, Override Delivery Style, Override Playback Speed, Override Emotional Delivery

---

## 5. Production Tracker Schema

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

Queued, Processing, Rendering, Ready for Editing, Editing, Ready for QA, Done, Error

---

## 6. Editor Brief Template - HIGHEST PRIORITY

Erika's stated priority: "very impressed with the detailed editing brief shown in this video. That's important."

The brief MUST always keep this fixed section order:

1. **Review Priorities**
2. **Customer Avatar and Emotional Arc**
3. **Editing Directives**
4. **Line-by-Line Visual Direction**

Section names cannot change without Erika's approval.

---

## 7. Drive Folder Structure (already created)

- 00_Test_Archive
- 01_Production_Tracker_Backend
- 02_Script_Docs (ID: 1JN7T4lmeiXXe0G3OpNcSXrz_24cVdQr3)
- 03_Editor_Briefs (ID: 1tst1vRaFDk7Y2YFx2ihdYiNlzKwi56Zz)
- 04_Raw_AI_Videos (ID: 1A_brjjrSgUO1NhUyUVMwhd_ndSOfPMW7)
- 05_ElevenLabs_Audio (ID: 1Jkl7hDHQSvvKlSwVU8NXfXINUoZ-pOsJ)
- 06_Edited_Videos
- 07_QA_Review
- 08_B-Roll_Library
- 09_Templates (ID: 1mXidTD8Dwhz4bzYaqVVPEdoIOsXx_Wqb)
  - Script_Doc_Template (ID: 1ZDum9DDkuEGPMpoqo39XbAiF-D5-bGMExfOmSY3gm_A)
  - Editor_Brief_Template (ID: 179Rc1u3mWVC-7hidFeyBLWxIp0Xxaocl_M52MsDc-4I)
- 10_Documentation

Parent folder: Chosen Agency (ID: 1xCplt3J0RNAPwDpWyjpqqXXTeTf3USPb)
Owner: richard@1altx.com

---

## 8. Build Phases

| Phase | Days | Goal |
|---|---|---|
| 1 | 1-2 | Backend foundation: workbook, tabs, statuses, templates, folder structure |
| 2 | 3-5 | Core text/doc automation: OpenAI generation, Script Doc, Editor Brief |
| 3 | 5-8 | Audio + video generation: ElevenLabs, HeyGen, write-back |
| 4 | 8-10 | Hardening + async handling: Render checker, error handling, logs |
| 5 | 10-12 | Visibility layer: Notion sync if approved |
| 6 | 12-14 | Acceptance + handoff: Tests, Looms, documentation, manager SOP |

---

## 9. API Specs

### OpenAI
- Purpose: script, caption, editor brief, hook/angle, classification
- Auth: native Make connection or Authorization: Bearer YOUR_OPENAI_API_KEY
- Rule: Force structured output where practical
- Working assumption: gpt-4o (awaiting Erika confirmation)

### ElevenLabs (Mandatory V1)
- Purpose: generate voice/audio from script
- Auth header: xi-api-key
- Approved voice IDs, model ID, voice settings must come from owner

### HeyGen
- Purpose: generate raw avatar video
- Auth header: X-API-KEY
- Async handling required if video generation returns Render Job ID

Required HeyGen payload baseline:
```json
{
  "avatar_id": "{{Avatar ID}}",
  "voice_id": "{{Voice ID}}",
  "script": "{{Script Text}}",
  "title": "{{Variation ID}}"
}
```

---

## 10. Required Builder Test Cases

| Test | Action | Pass Condition |
|---|---|---|
| Happy path | Insert complete row, Status = Queued | All docs/audio/video/statuses update |
| Missing data | Queue incomplete row | Filter blocks run, no junk assets |
| API error | Force one API to fail | Row captures Error Message, Status = Error |
| Async render | Use HeyGen async flow | Render checker updates final URL |
| Duplicate prevention | Run update-safe sync on existing record | No duplicate output records |

---

## 11. Builder Deliverables

- Configured Google Sheet backend with all tabs
- Configured Google Docs templates
- All Make scenarios in approved phase scope
- All API connections configured securely
- Field map: every source column to destination property
- Credential map: where every key is stored
- Loom walkthrough of full system
- Loom walkthrough of every core scenario
- Written operating guide for non-technical manager
- Written troubleshooting section
- At least one preserved test row

---

## 12. Phase 2+ Advanced Scenarios (NOT IN V1)

After core V1 is stable:
1. Sheets to Notion Production Tracker Sync
2. Sheets to Notion Editor Scorecard Sync
3. Sheets to Notion Content Testing Sync
4. Sheets to Notion B-Roll Library Sync
5. Script Generator
6. AI Performance Classifier
7. Winner Auto-Promotion
8. Winner Clone Generator
9. Editor Performance Bonus Calculator
10. Editor Bonus Progress Dashboard
11. Monthly Bonus Summary Generator

---

## 13. Notes for Forge

**High-leverage piece:** Editor Brief generation. Erika referenced the inspiration Loom and said the detailed editing brief is the most important deliverable.

**Editor Brief 4-section structure is non-negotiable.**

**System Settings + Override pattern is non-negotiable.** Voice/avatar/delivery values cannot be hardcoded inside Make.

**Editor stage is manual.** Builder responsibility ends at Status = Ready for Editing.

**Approved OpenAI model:** Working assumption is gpt-4o. Awaiting Erika confirmation (kickoff sent Apr 28). Confirm before production.
