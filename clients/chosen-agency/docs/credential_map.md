# Chosen Agency — V1 Credential Map

**Version:** V1  
**Last Updated:** 2026-05-01  
**Note:** All API keys are currently in Richard's (builder) environment. At handoff, these swap to Erika's accounts. See Section 4 (Handoff Procedure).

---

## 1. API Keys

| Service | Key Name | Where stored during build | Long-term location | Used by Make Modules | Rotation procedure |
|---|---|---|---|---|---|
| **OpenAI** | `OPENAI-API-KEY-RICHARD` | Azure Key Vault `kvdaxdakonapilot` | Erika's OpenAI account → Make connection | M5 (Script), M23 (Editor Brief) | Generate new key in OpenAI dashboard → update Make connection |
| **ElevenLabs** | `ELEVENLABS-API-KEY` | Azure Key Vault `kvdaxdakonapilot` | Erika's ElevenLabs account → hardcoded in M7 header | M7 (audio generation) | Generate new key in ElevenLabs dashboard → update M7 `xi-api-key` header |
| **ElevenLabs Voice** | `ELEVENLABS-VOICE-ID-RICHARD` | Azure Key Vault `kvdaxdakonapilot` | System Settings tab: Default Voice ID | M2 (effective_voice_id default) | Update `Default Voice ID` row in System Settings tab |
| **HeyGen** | `HEYGEN-API-KEY` | Hardcoded in Make scenario M10 + M14 headers | Erika's HeyGen account → hardcoded in headers | M10 (video create), M14 (status check), Render Checker M2 | Generate new key in HeyGen account → update M10 + M14 + Render Checker M2 headers |
| **Google Sheets SA** | `google-sa-pvc-sheets` | Azure Key Vault `kvdaxdakonapilot` | SA: `n8n-sheets@positive-bonbon-478413-p1.iam.gserviceaccount.com` | Not in Make — used for scripted sheet operations only | Rotate SA key in GCP console → update Key Vault secret |
| **Make API** | `make-api-key` | Azure Key Vault `kvdaxdakonapilot` | Not needed by Erika post-handoff | Not used in scenarios | N/A for Erika |

---

## 2. Make Connections

These are named connections in Make.com that store OAuth/API credentials for each service. When you swap from Richard's accounts to Erika's, you update these connections.

| Connection Name | Service | Connection ID | Current owner | Make modules using it | Notes |
|---|---|---|---|---|---|
| Google Sheets (OAuth) | Google Sheets | `__IMTCONN__: 4472711` | richard@1altx.com | M1, M4, M6, M9, M11, M16, M17, M18, M19, Render Checker M1/M4/M5 | Uses OAuth — will need reauth as Erika's account at handoff |
| Google Docs (OAuth) | Google Docs | Same connection as Sheets (Richard's Google account) | richard@1altx.com | M24, M25 | Same OAuth token as Sheets |
| Google Drive (OAuth) | Google Drive | n8n cred `0MjijtGwtAOKVNBE` (separate from Make) | richard@1altx.com | M8 (Drive upload) | Note: M8 uses the Drive connection, not Sheets |
| OpenAI | OpenAI API | Native Make connection | richard@1altx.com | M5, M23 | Bearer token from `OPENAI-API-KEY-RICHARD` |
| HTTP (ElevenLabs) | ElevenLabs | No named connection — `xi-api-key` header in M7 | Hardcoded in M7 | M7 | Swap header value at handoff |
| HTTP (HeyGen) | HeyGen | No named connection — `X-Api-Key` header | Hardcoded in M10, M14 | M10, M14 | Swap header values at handoff |

---

## 3. Google Service Accounts

| SA Email | Project | Permissions | Used for | Shared on |
|---|---|---|---|---|
| `n8n-sheets@positive-bonbon-478413-p1.iam.gserviceaccount.com` | positive-bonbon-478413-p1 | Sheets API (read/write), Docs API | Script-based sheet operations (not Make) — used to populate test rows, read schema | Content_Pipeline_V1 sheet + both Doc templates |

> **At handoff:** This SA can be revoked or transferred. Erika's team won't need it for day-to-day operation — they use the Make connection (Google OAuth) directly.

---

## 4. Handoff Procedure

When Erika is ready to take over the system, these 5 steps transfer all ownership:

**Step 1 — Erika creates accounts and sends credentials to Richard:**
- OpenAI API key
- ElevenLabs API key + Voice ID (must be from Erika's account)
- HeyGen API key + Avatar ID (must be from Erika's account)
- Google account to use for Sheets/Docs/Drive (must be able to access the Drive folder)

**Step 2 — Transfer Google Drive folder:**
- In Google Drive, share the "Chosen Agency" parent folder (`1xCplt3J0RNAPwDpWyjpqqXXTeTf3USPb`) with Erika's Google account as owner
- Transfer ownership of all Docs/Sheets inside the folder to Erika's account
- Remove Richard's `richard@1altx.com` as owner after Erika confirms access

**Step 3 — Update Make connections:**
- In Make.com org 885318, edit the Google Sheets connection: disconnect Richard's account, connect Erika's Google account
- Edit the OpenAI connection: update the API key to Erika's key
- In M7 mapper: replace `xi-api-key` header value with Erika's ElevenLabs key
- In M10/M14 mapper: replace `X-Api-Key` header value with Erika's HeyGen key
- In Render Checker M2: replace `X-Api-Key` header value with Erika's HeyGen key

**Step 4 — Update System Settings tab:**
- Update `Default Voice ID` row with Erika's ElevenLabs Voice ID
- Update `Default Avatar ID` row with Erika's HeyGen Avatar ID

**Step 5 — Verify with a test run:**
- Add a new row to the Queue tab with Status=Queued
- Confirm it progresses through all statuses to Done
- Confirm Script Doc and Editor Brief appear in the correct Drive folders
- Confirm video appears in Raw Video Link column
- Sign off and Richard hands over the Make.com org (or creates a separate workspace for Erika)

**Estimated handoff time:** ~45–60 minutes once all credentials are received from Erika.

---

## 5. Current API Key Values (Build Environment)

> **⚠️ Note:** These are Richard's build environment keys. All will be replaced at handoff.

| Service | Key preview | Location |
|---|---|---|
| HeyGen | `sk_V2_hgu_kXkUI...` (rotated 2026-04-30) | Hardcoded in M10/M14/Render Checker M2 headers |
| ElevenLabs Voice ID | `IuxDTLynYdvisya7jrK5` | System Settings tab + M2 hardcoded default |
| HeyGen Avatar ID | `Adrian_public_3_20240312` | M2 hardcoded default |
| OpenAI model | `gpt-4o` | M2 variable `openai_model` |

---

## 6. Additions — 2026-05-10

### New scenarios beyond original V1 scope

| Scenario | ID | Webhook URL / Trigger | Purpose | Status |
|---|---|---|---|---|
| Chosen Agency - Intake Form Receiver | 5021573 | https://hook.us2.make.com/30h80b30koqjpmd2xknjxrrr686qkxcr | Receives form POST → adds Queue row → triggers V1 | Active |
| HeyGen Avatar Lister | 5021656 | https://hook.us2.make.com/axqmbdvrrgohpd4h59xg61sqrfs8tnuk | Returns HeyGen avatar list to the intake form for the picker UI | Active |

### Updated default avatar

| Setting | Old value | Current value | Where |
|---|---|---|---|
| Default Avatar ID | `Adrian_public_3_20240312` | `e77c5c739e344e54af85ca96862e7ac3` (1AltX brand: "Richard at his wooden desk") | M2 hardcoded fallback |

> **At handoff:** Replace this default with Erika's preferred HeyGen avatar/talking-photo ID. Step 4 of the handoff procedure already covers this.

### Intake form

`clients/chosen-agency/intake-form.html` (in repo) is a static HTML page that posts to scenario 5021573. Host wherever (Drive, Netlify, GitHub Pages, embedded in client portal). The form auto-fetches recommended avatars from scenario 5021656 — no maintenance needed.

> **At handoff:** Erika's developer can swap in her own webhook URLs by editing the two `const` declarations at the top of the script block. No other changes required.

### V1 scheduling change

V1 (4894796) is now `on-demand` only — no automatic polling. It fires when the Intake Form Receiver triggers it via Make API call. This eliminates spurious "BundleValidationError" entries in execution history that occurred on empty-queue polls.

> **At handoff:** If Erika wants polling back (e.g., for batch sheet uploads), change scheduling type to `indefinitely` with the desired interval. V1 logic is unchanged.
