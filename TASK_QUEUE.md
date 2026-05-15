---

## [FORGE] RIA Website Email Scraper — 2026-05-14

**Priority:** HIGH
**Assigned to:** Forge
**Requested by:** Richard via Claude

### Objective
We have 1,825 SEC-registered RIA firm websites. For each firm, attempt to find the email address(es) of key decision-makers (CEO, Managing Partner, Founder, CCO, Principal) by scraping the firm's website.

### Input File
`/mnt/user-data/outputs/ria_domains_for_forge.csv`

Columns: `crd, firm_name, city, state, phone, domain, employees`

### What to Do Per Firm

1. Visit `https://{domain}/contact` and `https://{domain}/about` and `https://{domain}/team`
2. Scrape any email addresses found on those pages
3. If no emails found via contact pages, try common patterns:
   - `info@{domain}`
   - `contact@{domain}`
   - Check if mailto: links exist anywhere on homepage
4. Also check for staff directory pages listing advisor names and titles

### Output Format
Write results to `/mnt/user-data/outputs/ria_emails_scraped.csv` with columns:
`crd, firm_name, domain, city, state, email, email_source, contact_name, contact_title`

- `email_source`: where it was found (e.g. "contact page", "team page", "pattern guess")
- `contact_name`: name if found alongside email, else blank
- `contact_title`: title if found, else blank

### Scope
- Process all 1,825 firms
- Skip firms where domain returns 404 or timeout after 5 seconds
- Rate limit: 1 request per second per domain
- Log skipped firms separately

### Notes
- This is for Dakona RIA outreach — building a cold email list
- No login required on any of these sites — public pages only
- Focus on quality over speed — we need real emails, not guesses

**Status:** QUEUED

---

## [FORGE] AVMOE Workflow Screen Recording — 2026-05-14

**Priority:** HIGH
**Assigned to:** Forge
**Requested by:** Richard via Claude

### Objective
Screen-record the full AVMOE (Automated Vertical Market Outreach Engine) pipeline running live in n8n. This recording becomes the demo scene (scene-03) for a CatalogMint video for the 1AltX Upwork catalog.

### What to Record

Use Puppeteer with Chrome DevTools Protocol or OBS to capture a clean screen recording of the following sequence:

**Scene 1 — n8n workflow overview (30 sec)**
- Open https://n8n.dakona.net/workflow/auDaMTx0FXQJUw72
- Zoom out to show the full pipeline (all 4 phases visible)
- Pan slowly left to right so viewer sees the entire flow
- Pause 3 seconds on the Pipeline Config node

**Scene 2 — Apollo Search live (45 sec)**
- Trigger the workflow manually (click Run Pipeline)
- Show the Apollo Search node executing
- Show Filter New People → Bulk Enrich running
- Pause on the Format Contacts node output showing real contact data

**Scene 3 — Icebreaker generation (30 sec)**
- Show Generate Icebreaker node firing against the Anthropic API
- Show the Process Icebreaker output with a real generated icebreaker
- Highlight the personalized text

**Scene 4 — Instantly campaign (30 sec)**
- Open https://app.instantly.ai and navigate to "Dakona RIA Outreach - IT and AI" campaign
- Show the campaign settings (9 email addresses, 3-step sequence)
- Show contacts populating in the leads tab

**Scene 5 — HubSpot result (15 sec)**
- Open HubSpot → DAX RIA Prospects pipeline
- Show the deal stages

### Recording Specs
- Resolution: 1920x1080
- Frame rate: 30fps
- No cursor jitter — use smooth mouse movements
- No audio needed (HeyGen avatar will narrate)
- Clean browser — hide bookmarks bar, use incognito if needed

### Output
Save to: `C:\Users\18473\Dropbox\Companies\1AltX\CatalogMint\raw\avmoe-demo-raw.mp4`

### Notes
- Credentials are all in Key Vault — use existing n8n, Instantly, HubSpot logins
- Keep each scene tight — total target runtime 2.5–3 minutes
- If OBS is not installed, use Puppeteer screen capture via CDP

**Status:** QUEUED
