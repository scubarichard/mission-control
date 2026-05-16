---

## ⚡ [FORGE] RIA Website Email Scraper — COMPLETE ✅

**Status:** DONE — 763 verified contacts loaded into Instantly campaign `09646466-6077-46b7-9af2-341430e714a1`

---

## ⚡ [FORGE] Family Office Contact Enrichment — 2026-05-16

**Priority:** HIGH — next task
**Assigned to:** Forge
**Requested by:** Richard via Claude

### Objective
Pull, enrich, verify, and load family office decision-maker contacts into a new Instantly campaign.

### Apollo Search Parameters
```json
{
  "person_titles": ["CEO","Founder","Managing Partner","President","COO","Chief Investment Officer","Principal","Director"],
  "person_locations": ["United States"],
  "organization_num_employees_ranges": ["1,50"],
  "naics_codes": ["523920"],
  "q_keywords": "family office"
}
```
Total available: ~831 contacts

### Process
1. Pull all 831 via Apollo `mixed_people/api_search` + `bulk_match` enrichment (same as RIA run)
2. Cap at 2 contacts per firm domain
3. NeverBounce verify: `https://api.neverbounce.com/v4.2/single/check?key=private_2e6d0ca8158ea3a4f322bd1710dc9249&email={email}` — keep only `valid` and `catchall`
4. Cross-reference against RIA campaign emails in `/mnt/user-data/outputs/ria_emails_capped.csv` — remove duplicates
5. Generate Claude icebreaker per contact — tone: managing complex multi-generational wealth with a small team, cybersecurity exposure, no AI story for principal families asking about it. Start with "Hey [firstName]." Soft open. 1-2 sentences.
6. Push verified contacts to Instantly campaign ID: `4065e499-1a34-4e36-8e55-5fa60183eec7`

### Output File
`/mnt/user-data/outputs/family_office_emails.csv`
Columns: `firm_name, domain, email, contact_name, contact_title, icebreaker, neverbounce_result, pushed_to_instantly`

### Keys
- Apollo: Key Vault `apollo-api-key`
- NeverBounce: `private_2e6d0ca8158ea3a4f322bd1710dc9249` (Key Vault `neverbounce-api-key`)
- Instantly v2: Key Vault `instantly-api-key-v2`

Post total verified count and completion to #dax-collab.

**Status:** QUEUED

---

## [FORGE] AVMOE Workflow Screen Recording — 2026-05-14

**Priority:** HIGH — after family office enrichment
**Assigned to:** Forge

### What to Record
5 scenes of the AVMOE n8n pipeline running live:
1. n8n workflow `auDaMTx0FXQJUw72` — full view, pan left to right (30 sec)
2. Apollo Search executing — show contact data output (45 sec)
3. Icebreaker generation — show Claude API response (30 sec)
4. Instantly campaign `app.instantly.ai` → Dakona RIA Outreach (30 sec)
5. HubSpot → DAX RIA Prospects pipeline (15 sec)

**Specs:** 1920x1080, 30fps, no audio, clean browser
**Output:** `C:\Users\18473\Dropbox\Companies\1AltX\CatalogMint\raw\avmoe-demo-raw.mp4`

**Status:** QUEUED — after family office enrichment

---

## [TRITON or NAUTILUS] CatalogMint — AVMOE Video Production — 2026-05-14

**Priority:** HIGH
**Depends on:** Forge screen recording

### Credentials (Key Vault: kvdaxdakonapilot)
- `HEYGEN-API-KEY`, `HEYGEN-AVATAR-ID` (0f0656d38e0545918de84dd25f2d31af), `HEYGEN-VOICE-ID`
- `elevenlabs-api-key`, `elevenlabs-voice-id-richard`

### Scenes
1. HeyGen intro: "Most companies spend five to twenty thousand dollars a year on contact databases — and still get reply rates under one percent. What if you could pull a verified list of every decision-maker in your target market from a free government database, have AI write a personal opener for each one, and launch a fully automated email campaign — all without buying a single contact? In this video I'll show you exactly how we built that system, and how we can build it for your business."
2. FFmpeg title card (4 sec, #1F4E79): "Automated Vertical Market Outreach Engine" / "Free Data → AI Personalization → Booked Meetings" / "1AltX"
3. Demo — copy Forge raw MP4 untouched
4. FFmpeg CTA card (4 sec): "1altx.com" / "Book a free scoping call"
5. HeyGen outro (LOCKED): "You'll be amazed how much manual work disappears when the right automation kicks in. Visit onealtx.com and schedule a call — we'll scope it, size it, and give you a straight price."

**Output:** `C:\Users\18473\Dropbox\Companies\1AltX\CatalogMint\final\avmoe-outreach-engine.mp4`

**Status:** WAITING ON FORGE
