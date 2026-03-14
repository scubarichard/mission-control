# DAX Deployment Context

## Custom Domain — dakona-pilot

The `dakona-pilot` deployment uses the custom domain **dax.dakona.com**.

**DAX URL:** https://dax.dakona.com

### DNS Configuration (GoDaddy — dakona.com)

| Type  | Name       | Value |
|-------|------------|-------|
| TXT   | asuid.dax  | `60BE6AD3B61C314CD4A166BDA739CDE721EF3DC7F898054F596D7533805D9BDD` |
| CNAME | dax        | `ca-dax-dakona-pilot.icyplant-88ae76cd.eastus.azurecontainerapps.io` |

### Custom Domain Setup (after infrastructure deployment)

After deploying the Container App, bind the custom domain:

```powershell
# 1. Add the hostname
az containerapp hostname add `
    --name ca-dax-dakona-pilot `
    --resource-group rg-dax-dakona-pilot `
    --hostname dax.dakona.com

# 2. Bind with a managed certificate
az containerapp hostname bind `
    --name ca-dax-dakona-pilot `
    --resource-group rg-dax-dakona-pilot `
    --hostname dax.dakona.com `
    --environment managedEnvironment-dax-dakona-pilot `
    --validation-method CNAME
```

### Important: Rerun Deploy-SSOConfig.ps1 after custom domain setup

After binding a custom domain, `Deploy-SSOConfig.ps1` **must be rerun** with the
new URL so that `DOMAIN_SERVER` and `DOMAIN_CLIENT` env vars update correctly.
Without this, SSO redirects will still point to the old Container Apps URL and
authentication will fail.

### Status

**dax.dakona.com is live and SSO is working.** The Entra app registration has
redirect URIs for both the raw Container Apps URL and the custom domain.

### Deployment Commands (dakona-pilot)

When running Deploy-EntraApp.ps1, pass both the Container Apps URL and custom domain:

```powershell
./scripts/Deploy-EntraApp.ps1 -ClientName dakona-pilot `
    -LibreChatUrl "https://ca-dax-dakona-pilot.icyplant-88ae76cd.eastus.azurecontainerapps.io" `
    -CustomDomainUrl "https://dax.dakona.com"
```

When running Deploy-SSOConfig.ps1, use the custom domain:

```powershell
./scripts/Deploy-SSOConfig.ps1 -ClientName dakona-pilot `
    -ClientTenantId "d2a3c346-00f3-47dd-a53e-caa3fca74714" `
    -LibreChatUrl "https://dax.dakona.com"
```

## UI Customization State

Current UI polish applied (v1.1.1+):

| Item | Method | Value |
|------|--------|-------|
| Login logo | Dockerfile COPY → `logo.svg` | Dakona wordmark (SVG-wrapped PNG) |
| Favicons | Dockerfile COPY | `lexi_avatar_384.png` → favicon-16/32, apple-touch-icon |
| App title | Env var `APP_TITLE` | "DAX" |
| Footer | Env var `CUSTOM_FOOTER` | Hidden (single space) |
| Welcome message | `librechat.yaml` `customWelcome` | "Governed AI for RIAs" |
| AI avatar icon | `librechat.yaml` modelSpecs `iconURL` | lexi_avatar_384.png (blob storage) |
| Endpoint picker | `librechat.yaml` `endpointsMenu` | Hidden |
| Model selector | `librechat.yaml` `modelSelect` | Hidden |
| Presets | `librechat.yaml` `presets` | Hidden |
| Email login | Env var `ALLOW_EMAIL_LOGIN` | Disabled |
| Registration | Env var `ALLOW_REGISTRATION` | Disabled |

**Note:** `hideFooter` is not a valid key in LibreChat v0.8.3. The footer
is hidden via the `CUSTOM_FOOTER` environment variable set to a single space.
`APP_LOGO` is also not a valid key — the logo is baked into the Docker image.

## Critical Fixes & Lessons Learned (v1.2.0)

### Multi-User Login Fix (CRITICAL)

**Root cause:** Cosmos DB MongoDB API treats null as a unique value for unique
indexes. LibreChat's User schema creates `unique: true, sparse: true` indexes on
`googleId`, `facebookId`, `openidId`, `samlId`, `ldapId`, `githubId`, `discordId`,
`appleId`. On Cosmos DB, only the first user can ever log in — all subsequent
users get E11000 duplicate key error on the null social ID fields.

**Fix (two-part):**
1. **Build-time sed patch** in Dockerfile removes `unique: true` from the compiled
   `@librechat/data-schemas/dist/index.cjs` and `index.es.js` bundles. The bundle
   is pretty-printed (NOT minified), so the sed uses multi-line matching. Verified
   locally: removes exactly 8 unique constraints (24 → 16 occurrences), preserving
   email's unique constraint.
2. **Runtime entrypoint** (`patches/entrypoint.sh`) runs `drop-unique-indexes.js`
   before LibreChat starts. If the `users` collection has bad unique indexes, it
   drops the entire collection (Cosmos does NOT allow modifying unique indexes on
   non-empty collections). LibreChat recreates it on first login with the patched
   schema.

**NEVER skip `Deploy-ContainerRegistry.ps1` when the Dockerfile or patches change.**
The sed patch only takes effect in the Docker image build.

### Entra App User Assignment (CRITICAL for every client deployment)

After deploying the Entra SSO app via `Deploy-EntraApp.ps1`:
1. Go to **Azure Portal → Enterprise Applications**
2. Find the DAX app (may need "All Applications" filter)
3. Go to **Users and groups → Add user/group**
4. Assign ALL users who should have access

**Without this step, only the deploying admin can log in.** This is not automated
by any script and must be done manually for each client.

### System Prompt Configuration

The DAX system prompt is set at two levels for reliability:
- `endpoints.azureOpenAI.systemPrompt` — endpoint-level default
- `modelSpecs.list[0].preset.promptPrefix` — injected as system message in API calls

`modelSpecs.systemPrompt` (outside the preset) does NOT work in LibreChat — it
was silently ignored. Only `promptPrefix` inside the preset is sent to the API.

The prompt covers: identity, platform architecture, 4-category help scope
(Compliance, Operations, IT, General Business), never-do list, compliance
guardrails, 5-layer SEC compliance explanation, and tone guidelines.

**Deploy via `Deploy-SSOConfig.ps1` only** — no ACR rebuild needed for prompt changes.

### TTS / STT

- OpenAI TTS enabled: `tts-1` model, voices: nova (default), shimmer, alloy
- OpenAI STT enabled: `whisper-1` model
- API key from Key Vault secret `openai-api-key`, injected as `TTS_API_KEY` env var
- `automaticPlayback: true`, `cacheTTS: true` in speechTab config
- Browser engine removed — OpenAI only

### Purview Correction

Purview Data Map does **NOT** support Cosmos DB MongoDB API. The correct compliance
story for conversation audit is:
- Cosmos DB retains all conversations (7-year retention via Log Analytics)
- `Get-ConversationReport.ps1` generates HTML compliance reports
- Purview governs M365-side controls only (DLP, Communication Compliance)

### Cosmos DB Access Notes

- **Cloud Shell + Portal Middleware IPs** must be added in Cosmos DB Networking
  settings before using Mongo Shell from the Azure Portal
- **Mongo Shell:** always `use librechat` — default database is `test`
- **Always close firewall after access:** run `Close-CosmosAccess.ps1` or
  `az cosmosdb update -n cosmos-dax-dakona-pilot -g rg-dax-dakona-pilot --public-network-access DISABLED`
- The open PATCH holds an exclusive lock — close may need retry after 2-3 minutes
- `Clear-DuplicateUsers.ps1` uses Cosmos REST API (no pymongo dependency)

## TODO / Roadmap

### Client Onboarding — B2B Guest Access

For non-Dakona clients, users authenticate via Azure AD B2B:
- No changes required on client's existing tenant
- No new passwords for their staff
- Client IT/MSP has nothing to configure

Deployment steps (on DAX tenant side):
1. Add client domain to `librechat.yaml` `allowedDomains`
2. Run `az ad invitation create` for each user
3. Users receive email, click accept, log in with existing Microsoft creds

**Script needed:** `scripts/Invite-ClientUsers.ps1`
- Takes `-ClientName`, `-UserEmails` params
- Sends B2B invitations from DAX tenant
- Adds domain to `allowedDomains` in yaml
- Redeploys SSO config
