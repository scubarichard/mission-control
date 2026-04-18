

## TASK-20260417-1ALTX-001
- **Assignee:** Forge
- **Status:** DO NOT EXECUTE — REVIEW WITH RICHARD FIRST
- **Priority:** High
- **From:** Sonnet (Richard)
- **Client:** 1AltX (reusable tool — first deployment: PNT)
- **Task:** Build Form Data Entry & Stress Test Program — "FormDriver"

---

### CONCEPT SUMMARY

Richard's idea: replace manual QA and the current read-only sweep with a program that actually drives the booking form like a real user — entering data field by field, page by page, from a fixture table — then verifies what was saved to Airtable matches what was entered. Run 10–20 scenarios in parallel or sequence to stress test the entire form. Capture errors, fix them, re-run until clean. The output is proof that the system works end to end under real data entry conditions, not just read-only inspection.

This is a 1AltX product — a reusable test harness that can be pointed at any form + any Airtable base, not just PNT. PNT is the first client it will be used for.

---

### PRODUCT NAME
**FormDriver** — Data-driven E2E form filler and stress tester

---

### ARCHITECTURE OVERVIEW

**Three components:**

1. **Fixture Engine** — reads test scenarios from a JSON fixture file. Each scenario is a complete, realistic booking with all fields populated across all pages. Scenarios are categorized by type (simple hiking, cycling with bikes, agency booking with commission, tailor-made, etc.).

2. **Driver Engine** — Puppeteer-based form driver that reads a scenario and executes it page by page. Fills every input, dropdown, date picker, checkbox, and repeating row (hotels, travelers, bikes, guides, reservations, transfers) exactly as a human would. Saves each page and handles any errors that surface.

3. **Verifier Engine** — after each scenario completes and the booking is submitted/released, reads the created Airtable record back via API and compares every field value against what the fixture specified. Reports mismatches, missing saves, and field mapping errors.

---

### FIXTURE FILE STRUCTURE

`scripts/fixtures/pnt_test_scenarios.json`

Each scenario is a complete booking object:

```json
{
  "id": "TC-001",
  "name": "Simple Hiking Self-Guided — Direct Client",
  "description": "Basic SG hiking tour, 2 pax, direct client, no bikes",
  "tags": ["hiking", "self-guided", "direct", "simple"],
  "pages": {
    "page1_travelers": {
      "travelers": [
        {
          "firstName": "James",
          "lastName": "Mueller",
          "email": "james.mueller@test.com",
          "phone": "+44 7700 900123",
          "nationality": "British",
          "dob": "1975-03-15",
          "dietaryRestrictions": "None",
          "roomType": "Double",
          "emergencyName": "Sarah Mueller",
          "emergencyPhone": "+44 7700 900124"
        },
        {
          "firstName": "Sarah",
          "lastName": "Mueller",
          "email": "sarah.mueller@test.com",
          "nationality": "British",
          "dob": "1978-07-22",
          "dietaryRestrictions": "Vegetarian",
          "roomType": "Double"
        }
      ]
    },
    "page2_booking": {
      "brand": "Portugal Nature Trails",
      "tour": "Rota Vicentina Historical Way SG",
      "region": "SW",
      "tourType": "Hiking",
      "guideType": "Self-Guided",
      "bookingType": "Direct",
      "beginDate": "2026-06-15",
      "endDate": "2026-06-22",
      "bookingOwner": "Diana Freire",
      "status": "Confirmed"
    },
    "page3_hotels": {
      "hotels": [
        {
          "name": "Vicentina Hotel",
          "checkIn": "2026-06-15",
          "checkOut": "2026-06-18",
          "roomType": "Standard",
          "rooms": 1,
          "mealPlan": "Breakfast",
          "status": "Confirmed"
        },
        {
          "name": "Zmar Eco Campo Resort",
          "checkIn": "2026-06-18",
          "checkOut": "2026-06-22",
          "roomType": "Standard",
          "rooms": 1,
          "mealPlan": "Breakfast",
          "status": "Confirmed"
        }
      ]
    },
    "page4_bikes": null,
    "page5_guides": null,
    "page6_reservations": {
      "reservations": [
        {
          "type": "Restaurant",
          "name": "Pont'a Pé",
          "date": "2026-06-17",
          "time": "19:30",
          "partySize": 2,
          "status": "Confirmed"
        }
      ]
    },
    "page7_pricing": {
      "basePricePerPerson": 1350,
      "seasonSupplement": 150,
      "soloSupplement": 0,
      "bikeRentalFee": 0,
      "commissionPercent": 0,
      "billingEntity": "PNT",
      "depositAmount": 500,
      "depositDueDate": "2026-04-15",
      "fatPNTNumber": "FAT-TEST-001"
    },
    "page10_transfers": {
      "arrivalTransfer": true,
      "arrivalFrom": "Aero LIS",
      "flightIn": "TP1234",
      "flightInDate": "2026-06-15",
      "flightInTime": "10:30",
      "departureTransfer": true,
      "departureTo": "Aero LIS",
      "flightOut": "TP5678",
      "flightOutDate": "2026-06-22",
      "flightOutTime": "14:00"
    }
  },
  "expected_airtable": {
    "Pax": 2,
    "Booking Type": "Direct",
    "Billing Entity": "PNT",
    "Base Price Per Person": 1350,
    "Season Supplement": 150,
    "Total Per Person": 1500,
    "Total Booking": 3000,
    "Fat PNT Number": "FAT-TEST-001"
  }
}
```

---

### TEST SCENARIO MATRIX (10 scenarios minimum)

| ID | Scenario | Key Coverage |
|---|---|---|
| TC-001 | Simple hiking SG, 2 pax, direct | Baseline happy path |
| TC-002 | Cycling SG, 4 pax, 4 bikes, direct | Bikes page, bike allocation |
| TC-003 | Hiking guided, 6 pax, guide assigned | Guides page |
| TC-004 | Agency booking, commission 20%, CN billing | Commission calc, CN entity |
| TC-005 | Multi-hotel, 8 nights, 3 hotels | Hotel date chaining |
| TC-006 | Tailor-made, non-standard hotels | Tailor Made checkbox |
| TC-007 | Solo traveler, solo supplement | Solo supplement pricing |
| TC-008 | Large group, 12 pax, multiple travelers | Travelers page stress |
| TC-009 | Full booking — all pages populated | Every field in play |
| TC-010 | Edge case — minimal data entry | Required field validation |

---

### BUILD PLAN (phases)

**Phase A — Fixture engine + single scenario runner**
- Build `scripts/form_driver/driver.js` — Puppeteer script that reads one scenario JSON and drives the form
- Start with TC-001 (simplest) — get one scenario running end to end
- Handle auth (sessionStorage inject), page navigation, field filling
- Log every action and every error to console + JSON report

**Phase B — Verifier**
- After form submission, read the created Airtable record
- Compare every `expected_airtable` field against actual Airtable values
- Output PASS/FAIL per field with expected vs actual
- Produce a `RESULTS/form_driver/TC-001_result.json` report

**Phase C — Fixture file**
- Write all 10 scenario JSONs in `scripts/fixtures/pnt_test_scenarios.json`
- Use realistic PNT data — real tour names, real hotel names from the Airtable base
- Cover the full scenario matrix above

**Phase D — Batch runner**
- `scripts/form_driver/run_all.js` — runs all scenarios sequentially
- 30-second gap between scenarios to avoid Airtable rate limits
- Produces aggregate report: scenarios passed, failed, errors per field
- HTML report matching the existing sweep report style

**Phase E — Cleanup**
- After each run, delete all test bookings from Airtable (using a `test_` prefix on booking names or a `Is Test` checkbox field)
- Ensure no test data pollutes production records

**Phase F — Integration**
- Add "Run FormDriver" button to admin.html alongside "Run Sweep"
- Webhook on n8n: `/pnt-run-formdriver` triggers batch run on VM
- Results committed to `RESULTS/form_driver/` and visible in admin page

---

### REUSABILITY DESIGN (1AltX product)

FormDriver is built as a configurable tool from day one:

- `formdriver.config.json` — points to any form URL, any Airtable base, any fixture file
- Page driver modules are pluggable — swap out `page3_hotels.js` for a different form's hotel page
- Verifier reads from config — field mappings are declared, not hardcoded
- CLI: `node run_all.js --config pnt.config.json --scenarios TC-001,TC-002`
- Future clients: swap config + fixture file, reuse all driver/verifier infrastructure

---

### OUTPUT

- `RESULTS/form_driver/run_YYYYMMDD_HHMMSS/`
  - `summary.json` — overall pass/fail counts
  - `TC-001_result.json` — per-scenario detail
  - `TC-001_screenshots/` — screenshot of each page after fill
  - `report.html` — visual report matching sweep report style
- Admin page shows latest run results inline

---

### NOTES FOR MORNING REVIEW
- Do NOT execute until Richard reviews and approves
- Discuss: should test bookings be deleted after each run, or kept for review?
- Discuss: run sequentially (safer) or parallel (faster)?
- Discuss: should this live in the pnt-central-brain repo or a separate 1altx-formdriver repo?
- Discuss: n8n VM execution vs Forge desktop execution
- Estimated build time: 2–3 Forge sessions across phases A–D. Phase E–F lighter.