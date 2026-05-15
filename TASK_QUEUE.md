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

---

## [TRITON or NAUTILUS] CatalogMint — AVMOE Video Production — 2026-05-14

**Priority:** HIGH
**Assigned to:** Triton or Nautilus (whoever is available)
**Requested by:** Richard via Claude
**Depends on:** [FORGE] AVMOE Workflow Screen Recording (must be complete first)

### Objective
Produce a complete, polished CatalogMint video for the AVMOE (Automated Vertical Market Outreach Engine) 1AltX Upwork catalog listing. Follow the CatalogMint 5-scene structure exactly.

---

### Credentials (all in Key Vault: kvdaxdakonapilot)

| Secret Name | Use |
|---|---|
| `HEYGEN-API-KEY` | HeyGen video generation |
| `HEYGEN-AVATAR-ID` | Avatar: `0f0656d38e0545918de84dd25f2d31af` |
| `HEYGEN-VOICE-ID` | HeyGen voice: `a9c42ba3dd4b441eac3fb3221c6fcf59` |
| `elevenlabs-api-key` | ElevenLabs TTS (backup/SFX) |
| `elevenlabs-voice-id-richard` | ElevenLabs voice: `IuxDTLynYdvisya7jrK5` |

Pull all secrets via: `az keyvault secret show --vault-name kvdaxdakonapilot --name <name> --query "value" -o tsv`

---

### Input File
Raw demo recording (from Forge task):
`C:\Users\18473\Dropbox\Companies\1AltX\CatalogMint\raw\avmoe-demo-raw.mp4`

---

### Output Folder Structure
```
C:\Users\18473\Dropbox\Companies\1AltX\CatalogMint\
├── raw\avmoe-demo-raw.mp4          ← Forge delivers this
├── scenes\avmoe\
│   ├── scene-01-intro.mp4
│   ├── scene-02-title.mp4
│   ├── scene-03-demo.mp4           ← copy of raw, untouched
│   ├── scene-04-cta.mp4
│   └── scene-05-outro.mp4
├── final\avmoe-outreach-engine.mp4 ← FFmpeg concat output
└── scripts\
    ├── avmoe-intro.md
    └── avmoe-outro.md
```

---

### Scene 1 — Intro Avatar (HeyGen API)

**Script (use verbatim):**
> "Most companies spend five to twenty thousand dollars a year on contact databases — and still get reply rates under one percent. What if you could pull a verified list of every decision-maker in your target market from a free government database, have AI write a personal opener for each one, and launch a fully automated email campaign — all without buying a single contact? In this video I'll show you exactly how we built that system, and how we can build it for your business."

**HeyGen API call:**
```json
{
  "video_inputs": [{
    "character": {
      "type": "avatar",
      "avatar_id": "0f0656d38e0545918de84dd25f2d31af",
      "avatar_style": "normal"
    },
    "voice": {
      "type": "text",
      "input_text": "<script above>",
      "voice_id": "a9c42ba3dd4b441eac3fb3221c6fcf59"
    },
    "background": {
      "type": "color",
      "value": "#1F4E79"
    }
  }],
  "dimension": { "width": 1920, "height": 1080 }
}
```

Poll `GET /v1/video_status.get?video_id=<id>` until status = "completed", then download MP4.
Save as: `scenes/avmoe/scene-01-intro.mp4`

---

### Scene 2 — Title Card (FFmpeg generated)

Generate a 4-second static title card using FFmpeg drawtext:

```bash
ffmpeg -f lavfi -i color=c=0x1F4E79:size=1920x1080:duration=4:rate=30 \
  -vf "drawtext=text='Automated Vertical Market Outreach Engine':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=(h-text_h)/2-60:fontfile=/path/to/Arial.ttf, \
       drawtext=text='Free Data  →  AI Personalization  →  Booked Meetings':fontcolor=0xADD8E6:fontsize=36:x=(w-text_w)/2:y=(h-text_h)/2+40:fontfile=/path/to/Arial.ttf, \
       drawtext=text='1AltX':fontcolor=white:fontsize=28:x=60:y=60:fontfile=/path/to/Arial.ttf" \
  -c:v libx264 -pix_fmt yuv420p scenes/avmoe/scene-02-title.mp4
```

Save as: `scenes/avmoe/scene-02-title.mp4`

---

### Scene 3 — Demo (copy from Forge)

Simply copy the raw recording untouched:
```bash
cp raw/avmoe-demo-raw.mp4 scenes/avmoe/scene-03-demo.mp4
```

---

### Scene 4 — CTA Card (FFmpeg generated)

```bash
ffmpeg -f lavfi -i color=c=0x1F4E79:size=1920x1080:duration=4:rate=30 \
  -vf "drawtext=text='1altx.com':fontcolor=white:fontsize=80:x=(w-text_w)/2:y=(h-text_h)/2-40:fontfile=/path/to/Arial.ttf, \
       drawtext=text='Book a free scoping call':fontcolor=0xADD8E6:fontsize=40:x=(w-text_w)/2:y=(h-text_h)/2+60:fontfile=/path/to/Arial.ttf" \
  -c:v libx264 -pix_fmt yuv420p scenes/avmoe/scene-04-cta.mp4
```

Save as: `scenes/avmoe/scene-04-cta.mp4`

---

### Scene 5 — Outro Avatar (HeyGen API)

**Script (use verbatim — this is the LOCKED CatalogMint CTA):**
> "You'll be amazed how much manual work disappears when the right automation kicks in. Visit onealtx.com and schedule a call — we'll scope it, size it, and give you a straight price."

Same HeyGen API call as Scene 1 with this script.
Save as: `scenes/avmoe/scene-05-outro.mp4`

---

### Final Assembly (FFmpeg concat)

Create `concat-list.txt`:
```
file 'scenes/avmoe/scene-01-intro.mp4'
file 'scenes/avmoe/scene-02-title.mp4'
file 'scenes/avmoe/scene-03-demo.mp4'
file 'scenes/avmoe/scene-04-cta.mp4'
file 'scenes/avmoe/scene-05-outro.mp4'
```

Run:
```bash
ffmpeg -f concat -safe 0 -i concat-list.txt -c copy final/avmoe-outreach-engine.mp4
```

Validate output plays cleanly start to finish.

---

### YouTube Chapters (for description)

```
00:00 Introduction
00:22 Title
00:27 Live Demo — n8n Pipeline Overview
01:00 Apollo Search & Contact Enrichment
01:45 AI Icebreaker Generation
02:15 Instantly Campaign Setup
02:45 HubSpot CRM Integration
03:05 Book a Call
```

---

### Upwork Catalog Listing Copy

**Title:**
Automated B2B Outreach System — Public Data + AI Personalization + Cold Email at Scale

**Description:**
Most companies spend $5K–$20K/year on contact databases and still get reply rates under 1%.

We built a fully automated outreach system that:
- Sources verified decision-maker contacts from free government databases (SEC, NPI, NMLS, state boards)
- Filters to your exact ICP — industry, size, geography, license type
- Uses AI to write a unique, personalized opener for every single contact
- Launches a multi-step cold email campaign automatically
- Routes replies to HubSpot and books meetings via Calendly — no human in the loop

Built and validated on the SEC-registered RIA market (2,917 verified firms, zero data cost).

Works for any regulated vertical: CPAs, healthcare practices, law firms, mortgage brokers, insurance agencies, contractors, and more.

**What you get:**
- ICP definition and database sourcing for your vertical
- Contact enrichment (email + decision-maker name)
- AI icebreaker generation for every contact
- Instantly campaign setup (sequence, A/B test, schedule)
- HubSpot or CRM integration
- Calendly auto-reply on positive responses
- 30-day monitoring and optimization

**Price:** Starting at $3,500 setup + $1,500/month management

**Tags:** cold email, outreach automation, lead generation, B2B sales, n8n, Apollo, Instantly, AI personalization, HubSpot

---

### Completion Checklist

- [ ] scene-01-intro.mp4 generated and plays cleanly
- [ ] scene-02-title.mp4 generated (4 sec, branded)
- [ ] scene-03-demo.mp4 copied from Forge raw
- [ ] scene-04-cta.mp4 generated (4 sec, branded)
- [ ] scene-05-outro.mp4 generated and plays cleanly
- [ ] final/avmoe-outreach-engine.mp4 assembled and validated
- [ ] Post completion to #dax-collab with file path

**Status:** WAITING ON FORGE (screen recording)
