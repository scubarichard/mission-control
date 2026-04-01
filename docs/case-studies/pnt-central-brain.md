# Case Study: Portugal Nature Trails (PNT Central Brain)
## How We Automated a 97-Task Tour Operations System in 2 Sprints

**Client:** Ari Adnan / Portugal Nature Trails (PNT)
**Industry:** Adventure Tourism / Tour Operations
**Stack:** Airtable + n8n + Cloudflare Workers + GitHub Pages + GHL
**Timeline:** 2 sprints (10 days)
**Investment:** $15,300

---

## The Challenge

Portugal Nature Trails runs 233 active tour products across Portugal — hiking, cycling, and multi-activity tours for international travelers. Their operations ran on spreadsheets:

- **828 hotels** tracked in Google Sheets with manual rate lookups
- **76 partner agencies** managed via email with no central record
- **Transfer logistics** (taxis, luggage, bikes) coordinated by phone and WhatsApp
- **Booking intake** was a paper form → email → manual Sheets entry pipeline
- **No consolidation visibility** — ops couldn't see when multiple bookings shared the same transfer route on the same day

**The real cost:** 3-4 hours per booking on admin. With 2-3 bookings per day, that's 60-80% of ops team time spent on data entry instead of guest experience.

---

## The Solution

We built PNT Central Brain — a unified operations platform replacing 12+ spreadsheets with a single connected system.

### Phase 1: Data Foundation (Sprint 1)
- **Airtable schema:** 27 tables covering Hotels (828), Hotel Rates (13,106), Bikes (238), Tours (233), Locations (238), Taxi Routes (558), Partners (76), Guides (23)
- **Booking intake form:** Custom HTML form with PIN authentication, auto-populating from Airtable
- **Zero orphan records:** 100% link integrity verified across all tables

### Phase 2: Operations Portal (Sprint 2)
- **Portal refactor:** Single 5,340-line form split into modular architecture (api.js, auth.js, portal.html, booking.html, manifest.html)
- **Transfer Manifest:** Interactive daily transfer viewer with date presets, filters (booking status, transfer status, service type), consolidation detection
- **Consolidation engine:** Automatically flags same-date + same-route transfers across bookings, shows suggested vehicle, combined pax count, and savings estimate
- **Vendor assignment:** One-click assign taxi vendor to entire consolidation group — saves to Airtable instantly
- **n8n automations:** Daily manifest Slack notification, inter-hotel transfer auto-creation, hotel rate locking on release

### Security & Deployment
- **Cloudflare Worker proxy:** Airtable token removed from client code, API calls routed server-side
- **GitHub Pages:** Auto-deploys on every push, GHL iframe for client access
- **Build versioning:** Every deployment tagged with build number visible in UI

---

## The Technical Architecture

```
CLIENT BROWSER
━━━━━━━━━━━━━━
portal.html (PIN gate)
  ├── booking.html (intake form)
  └── manifest.html (transfer manifest)
      ├── js/api.js (shared Airtable layer)
      └── js/auth.js (session management)
           │
           ▼
CLOUDFLARE WORKER (pnt-api.dakona.net)
  → Injects Airtable token server-side
  → Proxies all API calls
           │
           ▼
AIRTABLE (27 tables, 15,500+ records)
  ← n8n automations (3 workflows)
```

---

## The Results

### Data Migration
| Table | Records | Link Integrity |
|-------|---------|---------------|
| Hotels | 828 | 100% |
| Hotel Rates | 13,106 | 100% (zero orphans) |
| Partners | 76 | 100% |
| Guides/Staff | 23 | 100% |
| Taxi Routes | 558 | 100% |
| Tours | 233 | 100% |

### Operational Impact
- **Booking intake:** Paper form → digital in 5 minutes (was 45 min)
- **Transfer consolidation:** Visible instantly (was discovered by accident)
- **Rate lookups:** Automatic from 13,106 rate records (was manual Sheets search)
- **Partner data:** Searchable by country, language, tour type, service code (was a single spreadsheet)

### Cost Savings (Estimated)
- **3 hours/day saved** on booking admin → ~$45K/year in ops labor
- **Transfer consolidation** → estimated 15-20% reduction in taxi costs
- **Rate accuracy** → eliminated billing disputes from wrong hotel rates

---

## Technology Delivered

- 27 Airtable tables with full relational linking
- Custom booking intake form (5,300+ lines)
- Transfer manifest with consolidation engine
- 3 n8n automation workflows
- Cloudflare Worker API proxy
- GitHub Pages deployment pipeline
- Build versioning system
- PIN-gated operations portal

---

## Client Testimonial

> "We went from managing everything in spreadsheets to having a system that actually thinks for us. The transfer consolidation alone pays for itself — we were running separate taxis for guests going to the same hotel on the same day and didn't even know it."
> — Ari Adnan, PNT Operations

---

*Built by 1AltX LLC — AI-powered operations automation for service businesses.*
*Contact: richard@1altx.com*
