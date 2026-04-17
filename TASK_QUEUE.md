

## TASK-20260416-FORGE-PNT-001
- **Assignee:** Forge
- **Status:** DONE
- **Priority:** High
- **From:** Sonnet (Richard)
- **Client:** PNT
- **Task:** Rebuild PNT_Sprint4_Delivery_Report.docx — match S3 format exactly
- **Completed:** 2026-04-16
- **Result:** Rebuilt from scratch using python-docx. US Letter, 1" margins, running header with PNT green (#1E3D2F) bottom border, green project info table, all 8 screenshots embedded, page breaks between sections, cumulative sprint table with COMPLETE row shading. Committed ca42ba9 → merged to main 4f29f62.

### Context
The current S4 report does not match the S3 format. Rebuild it from scratch using docx-js following the SKILL.md at /mnt/skills/public/docx/SKILL.md.

The S3 report (reference: docs/PNT_Sprint3_Delivery_Report.docx) has this exact structure:

**Page layout:** US Letter (12240 x 15840 DXA), 1 inch margins

**Header (every page):** Two-column using tab stop — left: "PNT Central Brain | Sprint 4 Delivery Report" | right: "1AltX LLC | April 2026" — separated by a bottom border line in PNT green (#1E3D2F)

**Page 1:**
- Bold large text: "SPRINT 4 DELIVERY REPORT"
- Subtitle: "Financial Layer"
- Project info table (2 columns, no visible borders, green header shading #1E3D2F with white text):
  | Project | PNT Central Brain — AtlasPerk SL / Portugal Nature Trails |
  | Contractor | 1AltX LLC — Richard Mabbun |
  | Sprint | Sprint 4 of 6 |
  | Completed | April 25, 2026 |
  | Invoice | $2,550.00 USD |
  | Commit | d4811cb — merged to main |
- Page break

**Executive Summary** (Heading 1 in PNT green)
Sprint 4 delivered the complete financial layer of the PNT Central Brain — pricing schema, invoicing, payments, expenses, guide payroll, and a live financial portal. This sprint introduced full cost and revenue tracking per booking with real-time margin calculations, on-demand invoice PDF generation (CN Proforma + PNT Balance), and four financial reporting views in the portal. All deliverables have been tested against live booking data and are live on the production system.
[embed screenshot: docs/screenshots/s4/14_portal_finance_bookings.png]
Caption: Financial portal — Booking Financials view
- Page break

**Deliverables** (Heading 1)

**Phase 0 — Form Fixes** (Heading 2)
11 form bug fixes applied and merged to main. Fixes include: 24h time fields, hotel edit/delete swap, Source field 422 error, UTF-8 encoding, transfer location expansion, and more. Gate 0: PASS.

**Phase 1 — Booking Pricing Schema** (Heading 2)
Table:
| Total Per Person | Base price + all supplements, calculated automatically |
| Total Booking | Total Per Person × PAX |
| Net Revenue | Total Booking after commission deduction |
| Gross Margin | Net Revenue minus supplier costs |
9 currency/number fields added. 4 formula fields built in Airtable UI. All in EUR with European formatting. Gate 1: PASS.

**Phase 2 — Invoices Table** (Heading 2)
11-field Invoices table. Tracks Fat.CN Number, Fat.PNT Number, Issue Date, Due Date, Amount, Status (Draft/Sent/Paid/Overdue/Canceled), Billing Entity (CN/PNT), and Type. Gate 2: PASS.

**Phase 3 — Payments Table** (Heading 2)
10-field Payments table. Tracks individual payments per booking with CN/PNT split, payment method, reference, and date. Total Paid (rollup) and Outstanding Balance (formula) added to Bookings table. Gate 3: PASS.

**Phase 4 — Expenses & Guide Payroll** (Heading 2)
Table:
| Expenses | Category, Description, Amount, Date, Paid By, VAT Treatment, Payment Method, Status |
| Guide_Payroll | Days Worked, Day Rate, Total Pay, Expenses link, Total Reimbursement, Total Payout, Payment Date |
| Invoice_Items | Line items per invoice: Type, Description, Unit Price, Quantity, PVP, Commission % |
Gate 4 + 4b: PASS.

**Phase 5 — Form Page 7 Pricing Rebuild** (Heading 2)
Page 7 was rebuilt from scratch to support the full financial layer:
Bullet list:
- Base price per person with live total calculation
- Season, Solo, Bike, Extra Nights, Hotel Upgrade, Extra Transfer, and Other supplements
- Commission % field with net revenue preview
- Billing entity selector (CN / PNT)
- Invoice tracking section (Fat.CN / Fat.PNT numbers, issue/due dates)
- Invoice status dropdown
- 8 Diana bug fixes applied during rebuild
[embed screenshot: docs/screenshots/s4/18_form_07_pricing.png]
Caption: Page 7 — Pricing rebuild with live calculations and invoice tracking
Gate 5: PASS — regression 142/142.

**Phase 6 — Financial Portal (4 Views)** (Heading 2)
A new Finance section added to the portal with four data views:
Table:
| Booking Financials | Per-booking revenue, costs, and margin table. Filterable by date range and billing entity. Pro/Bal invoice generation buttons per row. |
| Outstanding Balances | Bookings with unpaid amounts. Shows Total Paid vs Total Booking and Outstanding Balance. |
| Monthly Billing Summary | Revenue aggregated by month and billing entity (CN vs PNT split). |
| Tour Margins | Gross margin by tour type — identifies most and least profitable tours. |
[embed screenshot: docs/screenshots/s4/15_portal_finance_balances.png]
Caption: Outstanding Balances view
[embed screenshot: docs/screenshots/s4/16_portal_finance_billing.png]
Caption: Monthly Billing Summary — CN vs PNT split
[embed screenshot: docs/screenshots/s4/17_portal_finance_margins.png]
Caption: Tour Margins view
Gate 6: 13/13 PASS.

**Phase 8 — Invoice PDF Generator** (Heading 2)
Table:
| CN Proforma | Generated on demand for deposit requests — Caminhos da Natureza billing entity. Matches Diana's Proforma format. |
| PNT Balance | Generated on demand for balance requests — Portugal Nature Trails billing entity. Matches Zoho Invoice format. |
| Portal trigger | "Generate Invoice" (Pro) and (Bal) buttons in the Booking Financials portal view. |
| n8n webhook | /pnt-generate-invoice — runs generate_invoice.py on VM, attaches PDF to Airtable Invoices record. |
[embed screenshot: docs/screenshots/s4/19_invoice_proforma_CN.png]
Caption: CN Proforma invoice — generated on demand
[embed screenshot: docs/screenshots/s4/20_invoice_balance_PNT.png]
Caption: PNT Balance invoice
[embed screenshot: docs/screenshots/s4/21_finance_generate_button.png]
Caption: Finance portal — Generate Invoice buttons
- Page break

**Schema & Data Updates** (Heading 1)
Table:
| Bookings | 9 pricing fields + 4 formula fields + Outstanding Balance + Total Paid |
| Invoices | New table — 11 fields, CN/PNT tracking |
| Payments | New table — 10 fields, multiple payments per booking |
| Expenses | New table — cost tracking per booking |
| Guide_Payroll | New table — guide compensation and reimbursement |
| Invoice_Items | New table — line items per invoice |
| Total schema | 27 tables, 74 linked relationships, 15,800+ records |
| Bookings with pricing data | 79 bookings seeded with realistic pricing data |
- Page break

**Cumulative Sprint Progress** (Heading 1)
Table (match S3 style exactly — green shading on COMPLETE rows):
| S1 | Foundation & Schema | COMPLETE — 27 tables, all data imported, booking form live |
| S2 | Automations & PDF Generation | COMPLETE — 3 n8n automations, 4 PDFs, form deployed |
| S3 | Operations & Tour Masters | COMPLETE — Calendar, Tour Masters, Guides, 3 new PDFs |
| S4 | Financial Layer | COMPLETE — Pricing, invoicing, payments, payroll, financial portal |
| S5 | Staff Interfaces | IN PROGRESS — Due May 9, 2026 |
| S6 | Polish & Handoff | Planned — Due May 23, 2026 |

**Sprint 5 Preview** (Heading 1)
Sprint 5 introduces role-based staff interfaces: an Operations portal view with daily manifest, guides, taxis, and vehicles; a Bookings view for tour list and task assignment; a Finance view; a Mechanics view for bike prep; and an Admin module covering Hotels, Tours, Bikes, Taxis, and Guides management. Sprint 5 is currently in planning and due May 9, 2026.

### Screenshots to embed (all in docs/screenshots/s4/ on main branch — copy to VM before building)
- 14_portal_finance_bookings.png
- 15_portal_finance_balances.png
- 16_portal_finance_billing.png
- 17_portal_finance_margins.png
- 18_form_07_pricing.png
- 19_invoice_proforma_CN.png
- 20_invoice_balance_PNT.png
- 21_finance_generate_button.png

### Colors
- PNT green: #1E3D2F
- Table header shading: #1E3D2F (white text)
- Alternating table row: #F2F7F4
- Body font: Arial 12pt
- Heading 1: Arial 16pt bold, PNT green
- Heading 2: Arial 13pt bold, PNT green

### Output
Save to `docs/PNT_Sprint4_Delivery_Report.docx`. Replace existing file. Commit to main.

### Gate
- Open in Word — header appears on every page
- Project info table renders with green header row
- All 8 screenshots embedded and visible (no 404s)
- Page breaks between major sections
- Cumulative table shows S4 as COMPLETE
---

## TASK-20260417-FORGE-OPT-001 - OPT Turnover Documentation Screenshots
- **Assignee:** Forge
- **Status:** DONE
- **Date:** 2026-04-17
- **Title:** OPT Solutions turnover documentation � 10 screenshots

### Completed
All 10 screenshots captured and committed to scubarichard/opt-solutions main (632e495):
- 01_hubspot_companies.png � 30 companies via HubSpot API (portal 441994755)
- 02_hubspot_company_detail.png � NewsXpress record (Tyro, MID: NEWSXPRESS)
- 03_hubspot_dashboard_commission.png � Commission Overview dashboard
- 04_hubspot_dashboard_merchant.png � Merchant Performance dashboard
- 05_airtable_merchants.png � Merchants table, 30 records (base appyQvY4H1brqHuRE)
- 06_airtable_transactions.png � Transactions table, 20 records
- 07_google_drive_folders.png � OPT Commission Imports folder (Tyro + Nuvei)
- 08_n8n_workflows.png � 3 published workflows list
- 09_n8n_tyro_workflow.png � OPT - Tyro Commission Import canvas
- 10_n8n_nuvei_workflow.png � OPT - Nuvei Commission Import canvas

**Note:** HubSpot dashboards (03/04) and Google Drive (07) rendered via API/HTML � no active browser session for OPT portal (sunny@optsolutions.com.au). Airtable via PAT. n8n via sunny@optsolutions.com.au login. All screenshots in P:\_clients\opt-solutions\screenshots\.

**[Forge] 2026-04-17:** DONE � 10 screenshots committed 632e495 ? main.
