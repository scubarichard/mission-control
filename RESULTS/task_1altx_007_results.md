# TASK-1ALTX-007 Results — Build 7A-API: Upwork Job Fetcher

**Status:** DONE (workflow INACTIVE — awaiting API key approval)
**Completed:** 2026-04-12
**Agent:** FORGE

## Summary

Workflow "1AltX 07A-API: Upwork Job Fetcher" created in n8n and left inactive.

- **Workflow ID:** gtQBqsGSbfWddnAV
- **Schedule:** Every 30 minutes (when activated)
- **Active:** No — waiting for Upwork API key approval

## Nodes (10)

1. Schedule Trigger — every 30 min
2. Get Existing Jobs — Google Sheets read (dedup source)
3. Build Search Queries — 6 search terms, extracts existing URLs
4. Fetch Jobs from Upwork — GraphQL API calls with OAuth token, dedup, budget filter
5. Has New Jobs? — IF node (totalNew > 0)
6. Map to Sheet Rows — transforms to sheet format (Job Title, UpWork Link, Date, Time, Job Link HTML)
7. Append to Sheet — Google Sheets append
8. Build Slack Message — summary of new jobs found
9. Post to Slack — #alerts (C0A20U1HDUM) via Dip Buyer credential
10. No New Jobs — noOp for false branch

## Search Terms

- n8n automation
- Make.com automation
- API integration CRM
- HubSpot automation
- GoHighLevel automation
- workflow automation

## Budget Filters

- Hourly: skip if max < $30/hr
- Fixed: skip if amount < $200

## OAuth Authorization — MANUAL STEP REQUIRED

Upwork uses OAuth 2.0 **authorization_code** flow (not client_credentials). Before the workflow can run, Richard must complete a one-time browser authorization:

1. **Wait for Upwork to approve the API key** (currently Disabled, submitted 2026-04-12)
2. Once approved, go to Upwork developer portal and **Enable** the key
3. Open this URL in a browser (replace CLIENT_ID with the key):
   ```
   https://www.upwork.com/ab/account-security/oauth2/authorize?response_type=code&client_id=0ca7373764b995a062189ba18af70bef&redirect_uri=https://n8n.dakona.net/webhook/upwork-oauth
   ```
4. Authorize the app — Upwork redirects to the callback URL with a `code` parameter
5. Exchange the code for access + refresh tokens (Forge will build the callback handler)
6. Store the access token as n8n environment variable `UPWORK_ACCESS_TOKEN`
7. Activate workflow gtQBqsGSbfWddnAV in n8n

## What This Replaces

| Before | After |
|--------|-------|
| 7A email parser + AHK scraper | 7A-API direct API calls |
| Manual Cloudflare babysitting | No browser needed |
| HTML scraping for job descriptions | Clean text from API |
| ~15 min manual cycle per batch | Fully automated every 30 min |

## Credentials

- Google Sheets: fhAvmmHWXh2VIsWu
- Slack: TONShNUzuumr22CY (Dip Buyer)
- Upwork: Key Vault secrets upwork-api-key + upwork-api-secret

## Next Steps

1. Upwork approves API key (up to 2 weeks)
2. Richard enables key and completes OAuth browser flow
3. Build OAuth callback webhook in n8n to handle token exchange
4. Store access token, activate workflow
5. Run side-by-side with 7A email parser briefly, then deactivate 7A
