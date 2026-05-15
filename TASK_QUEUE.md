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
