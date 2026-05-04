# Chosen Agency Content Pipeline V1 — Credential Map

**Version:** 1.0  
**Last Updated:** 2026-05-04

This document lists every credential, API key, and OAuth connection the pipeline depends on, where it's stored, and how to rotate it.

---

## At-a-Glance Summary

| Service | Auth Type | Where Stored | Owner |
|---|---|---|---|
| Google Sheets | OAuth | Make connection (Erika's Google account) | Erika |
| Google Drive | OAuth | Make connection (Erika's Google account) | Erika |
| Google Docs | OAuth | Make connection (Erika's Google account) | Erika |
| OpenAI | API key | Make scenario module config (Modules 5, 23) | Erika |
| HeyGen | API key | Make scenario module config (Modules 10, 14) | Erika |
| ElevenLabs | API key | Make scenario module config (Module 7) — DISABLED in V1.5 | Erika |

---

## OAuth Connections

OAuth connections in Make are tied to a specific Google account. Erika needs to:

1. Sign into Make.com with her account
2. When opening a Google Sheets/Drive/Docs module for the first time, click **Add new connection**
3. Authenticate with her Google Workspace account
4. Grant the requested scopes (read/write on Sheets, Drive, Docs)
5. Make stores this securely and reuses across all modules

**Connection labels in Make:**
- `Google Sheets — Chosen Agency`
- `Google Drive — Chosen Agency`
- `Google Docs — Chosen Agency`

If the OAuth token expires, Make will prompt to re-authenticate. Just click through the consent flow.

---

## API Keys

### OpenAI

- **Used by:** Module 5 (Script + Caption), Module 23 (Editor Brief)
- **Where stored:** Make connection labeled `OpenAI — Chosen Agency`
- **How to add/rotate:**
  1. Get the key from https://platform.openai.com/api-keys
  2. In Make: Settings → Connections → OpenAI → edit
  3. Paste new key, save
- **Cost:** ~$0.05-0.10 per row processed (gpt-4o)

### HeyGen

- **Used by:** Module 10 (create video), Module 14 (poll status)
- **Where stored:** Hardcoded in module headers as `X-Api-Key`
- **How to add/rotate:**
  1. Get the key from HeyGen dashboard → Account → API
  2. Open Module 10 in Make scenario
  3. Edit the `X-Api-Key` header value
  4. Repeat for Module 14
  5. Save scenario
- **Cost:** Per HeyGen plan tier (subscription-based, includes credits)

**Important:** HeyGen Voice ID `a9c42ba3dd4b441eac3fb3221c6fcf59` is currently hardcoded in Module 10. This is Richard's linked ElevenLabs voice. To use a different voice:
- Pick a HeyGen native voice from her account
- OR link Erika's own ElevenLabs voice to HeyGen (one-time setup in HeyGen dashboard)
- Update the `voice_id` field in Module 10 body

### ElevenLabs (Disabled in V1.5)

- **Used by:** Module 7 (Generate audio) — DISABLED
- **Where stored:** Module 7 header `xi-api-key`
- **Note:** V1.5 architecture uses HeyGen text mode; ElevenLabs is called internally by HeyGen via the linked voice. Direct ElevenLabs API calls are no longer needed for V1.

If reactivating ElevenLabs (e.g., for separate audio file delivery):
- Get key from https://elevenlabs.io/app/settings/api-keys
- Update Module 7 header
- Remove the always-false filter on Modules 7, 8, 9

---

## Google Drive Resources

| Resource | ID | Purpose |
|---|---|---|
| Parent folder | `1xCplt3J0RNAPwDpWyjpqqXXTeTf3USPb` (current/dev) → migrating to Erika's `17jLeE_EaJMsPHdAFm1uKeGAvubvrqMO0` | All assets live here |
| 02_Script_Docs | `1JN7T4lmeiXXe0G3OpNcSXrz_24cVdQr3` | Generated script docs |
| 03_Editor_Briefs | `1tst1vRaFDk7Y2YFx2ihdYiNlzKwi56Zz` | Generated editor briefs |
| Script Doc template | `1ZDum9DDkuEGPMpoqo39XbAiF-D5-bGMExfOmSY3gm_A` | Template for new script docs |
| Editor Brief template | `179Rc1u3mWVC-7hidFeyBLWxIp0Xxaocl_M52MsDc-4I` | Template for new editor briefs |
| V1 Sheet (Content_Pipeline) | `1reHZpPcnGy2PTXTqKTdR-otnbqEeRfDkhG3dR-yfHWo` | The main Queue |

These IDs are referenced in:
- Module 1 (Sheet ID)
- Modules 4, 6, 9, 11, 16, 17 (Sheet ID)
- Modules 24, 25 (Folder IDs and Template IDs)

---

## Make.com Account

- **Org:** 1AltX (5193163)
- **Team:** 885318
- **Folder:** 232853
- **Scenario:** "Chosen Agency - Content Pipeline V1" (id 4894796)
- **Render Checker:** "Chosen Agency - Render Checker" (id TBD on import)

Erika's user must have:
- Edit access to scenarios in this team
- Active Make subscription with sufficient ops quota

**Estimated Make ops:** ~120 ops per row (60 if HeyGen completes within 5 polls, 120 if it takes 40 polls)

---

## Handoff Procedure (Richard → Erika)

When V1 is ready to transfer to Erika's accounts:

### 1. Drive Migration

1. Move/copy entire folder structure from Richard's Drive to Erika's parent folder `17jLeE_EaJMsPHdAFm1uKeGAvubvrqMO0`
2. Note new IDs for: parent, 02_Script_Docs, 03_Editor_Briefs, Script template, Brief template, V1 Sheet
3. Update each in Make scenario (Modules 1, 4, 6, 9, 11, 16, 17, 24, 25)

### 2. OAuth Swap

1. Erika signs into Make
2. Re-authorizes Google connections under her account
3. Repoint scenario's google-sheets, google-drive, google-docs connections

### 3. API Key Swap

1. Update OpenAI connection with Erika's API key
2. Update HeyGen X-Api-Key header in Modules 10, 14
3. (Optional) Update ElevenLabs key if reactivating Modules 7-9

### 4. Voice/Avatar Defaults

1. In Module 2, update `effective_avatar_id` fallback if Tyler isn't on Erika's HeyGen plan
2. In Module 10, update `voice_id` to a voice on Erika's HeyGen account
3. Update System Settings tab in Sheet with Erika's preferences

### 5. Test Run

1. Reset a test row to `Queued`
2. Run scenario once
3. Verify all 4 outputs populate correctly with Erika's branding/voice

---

## Security Notes

- Never share API keys in Slack/email plaintext
- Rotate keys quarterly or after team member changes
- Use Make's connection feature for OAuth (don't hardcode tokens)
- HeyGen API key in module headers is technically hardcoded — consider moving to a Make data store for V2

## Cost Tracking

Per row processed (estimate):
- OpenAI: $0.05-0.10
- HeyGen: ~1 video credit (varies by plan)
- ElevenLabs: $0 (V1.5; HeyGen's linked voice doesn't bill separately on most plans)
- Make ops: ~120 ops
- Drive/Sheets/Docs: free

**Estimated cost per video:** $0.10-0.30 + HeyGen credit
