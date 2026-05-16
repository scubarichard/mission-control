---

## ⚡ [FORGE] RIA Website Email Scraper — URGENT — 2026-05-14

**Priority:** CRITICAL — DO THIS FIRST BEFORE ANYTHING ELSE
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

**Status:** QUEUED — TOP PRIORITY

---

## [FORGE] AVMOE Workflow Screen Recording — 2026-05-14

**Priority:** HIGH — after email scraper
**Assigned to:** Forge
**Requested by:** Richard via Claude

### Objective
Screen-record the full AVMOE pipeline running live in n8n for the CatalogMint video.

### What to Record

**Scene 1 — n8n workflow overview (30 sec)**
- Open https://n8n.dakona.net/workflow/auDaMTx0FXQJUw72
- Zoom out to show full pipeline, pan left to right

**Scene 2 — Apollo Search live (45 sec)**
- Trigger workflow manually, show nodes executing

**Scene 3 — Icebreaker generation (30 sec)**
- Show Generate Icebreaker node, show Claude API response

**Scene 4 — Instantly campaign (30 sec)**
- Open app.instantly.ai → Dakona RIA Outreach campaign

**Scene 5 — HubSpot result (15 sec)**
- Open HubSpot → DAX RIA Prospects pipeline

### Recording Specs
- Resolution: 1920x1080, 30fps, no audio, clean browser

### Output
`C:\Users\18473\Dropbox\Companies\1AltX\CatalogMint\raw\avmoe-demo-raw.mp4`

**Status:** QUEUED — after email scraper

---

## [TRITON or NAUTILUS] CatalogMint — AVMOE Video Production — 2026-05-14

**Priority:** HIGH
**Assigned to:** Triton or Nautilus
**Depends on:** Forge screen recording must be complete first

### Credentials (Key Vault: kvdaxdakonapilot)
- `HEYGEN-API-KEY`, `HEYGEN-AVATAR-ID` (0f0656d38e0545918de84dd25f2d31af), `HEYGEN-VOICE-ID`
- `elevenlabs-api-key`, `elevenlabs-voice-id-richard`

### Input
`C:\Users\18473\Dropbox\Companies\1AltX\CatalogMint\raw\avmoe-demo-raw.mp4`

### Scenes

**Scene 1 — Intro Avatar (HeyGen)**
> "Most companies spend five to twenty thousand dollars a year on contact databases — and still get reply rates under one percent. What if you could pull a verified list of every decision-maker in your target market from a free government database, have AI write a personal opener for each one, and launch a fully automated email campaign — all without buying a single contact? In this video I'll show you exactly how we built that system, and how we can build it for your business."

**Scene 2 — Title Card (FFmpeg, 4 sec)**
- Dark blue background (#1F4E79)
- "Automated Vertical Market Outreach Engine"
- "Free Data → AI Personalization → Booked Meetings"
- "1AltX" top left

**Scene 3 — Demo**
Copy raw MP4 from Forge untouched

**Scene 4 — CTA Card (FFmpeg, 4 sec)**
- "1altx.com"
- "Book a free scoping call"

**Scene 5 — Outro Avatar (HeyGen — LOCKED CTA)**
> "You'll be amazed how much manual work disappears when the right automation kicks in. Visit onealtx.com and schedule a call — we'll scope it, size it, and give you a straight price."

### Output
`C:\Users\18473\Dropbox\Companies\1AltX\CatalogMint\final\avmoe-outreach-engine.mp4`

Post completion to #dax-collab.

**Status:** WAITING ON FORGE
