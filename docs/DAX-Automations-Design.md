# DAX Automations — Product Design Document

**Version:** 1.0 Draft
**Date:** 2026-03-12
**Status:** Phase 2 Design

---

## Executive Summary

DAX Automations extends the DAX governed AI workspace with pre-built
workflows that run automatically inside each RIA's Azure tenant. Every
automation uses the same GPT-4o endpoint, the same audit logging, and
the same compliance controls as the DAX chat UI — but actions happen
without staff opening a browser.

Automations are orchestrated by n8n (self-hosted in the client's Azure
tenant) connecting to Azure OpenAI, Microsoft 365, SharePoint, and the
firm's CRM (Redtail or Salesforce Financial Services Cloud).

---

## Architecture Overview

```
                        Client's Azure Tenant
 +---------------------------------------------------------+
 |                                                         |
 |  M365 / Outlook / SharePoint / Teams                    |
 |       |            |            |                       |
 |       v            v            v                       |
 |  +------------------------------------------+          |
 |  |           n8n (Container App)             |          |
 |  |  - Workflow engine (self-hosted)          |          |
 |  |  - Webhook triggers + schedules          |          |
 |  |  - Credential vault (Azure KV-backed)    |          |
 |  +------+----------+----------+-------------+          |
 |         |          |          |                         |
 |         v          v          v                         |
 |   Azure OpenAI   CRM API   Log Analytics               |
 |   (GPT-4o)      (Redtail/  (audit trail)               |
 |                  Salesforce)                             |
 |                                                         |
 +---------------------------------------------------------+
```

**Key principle:** n8n runs inside the client's tenant, not in
Dakona's. All data stays within the compliance boundary. Every
AI call is logged to the same Log Analytics workspace used by
DAX Phase 1, maintaining the unbroken 7-year audit trail.

---

## Top 10 Automation Workflows

---

### 1. Client Meeting Prep Brief

**The pitch:** Before every client meeting, DAX automatically pulls
the client's recent portfolio performance, account activity, and any
compliance notes, then generates a one-page briefing document ready
for the advisor — no research time needed.

**Trigger:** Calendar event with client name (15 minutes before meeting)

**Workflow:**
```
Graph Calendar webhook (meeting in 15 min)
  -> Extract client name from meeting subject/attendees
  -> Query CRM API: client profile, AUM, risk tolerance, last meeting notes
  -> Query CRM/custodian: recent account activity, deposits/withdrawals
  -> Azure OpenAI GPT-4o: generate structured briefing
     Prompt: "Generate a pre-meeting brief for [client]. Include:
              portfolio summary, recent activity, open action items,
              compliance flags, and suggested talking points."
  -> Format as HTML email
  -> Send via Graph Mail to advisor
  -> Log to Log Analytics (automation-audit table)
```

**n8n nodes:** Microsoft Graph Calendar Trigger -> HTTP Request (CRM) -> Azure OpenAI -> Microsoft Graph Mail -> HTTP Request (Log Analytics)

**Compliance:** Briefing content logged to Log Analytics with timestamp,
client ID, advisor ID, and full AI output. No briefing contains
performance projections or guarantees (enforced via system prompt
guardrails). Retained 7 years per Rule 17a-4.

---

### 2. Client Email Draft & Review

**The pitch:** When an advisor needs to email a client, they type a
quick note in Teams or tag DAX — and get back a polished, compliant
draft that avoids regulatory red-flag language, ready to send.

**Trigger:** Teams message to DAX channel or tagged @DAX, or email to
a designated drafts@ address

**Workflow:**
```
Teams webhook / Outlook rule (incoming draft request)
  -> Extract: recipient client, intent, key points
  -> Query CRM: client name, account type, communication preferences
  -> Azure OpenAI GPT-4o: generate compliant email draft
     System prompt includes:
       - Avoid performance guarantees, promissory language
       - Include required disclosures for the communication type
       - Match firm's tone and style guide
       - Flag if content needs CCO review
  -> Compliance scan: regex check for prohibited terms
     (guaranteed, risk-free, assured returns, etc.)
  -> If flagged: route to CCO queue in Teams with annotations
  -> If clean: send draft back to advisor via Teams/email
  -> Log full interaction to Log Analytics
```

**n8n nodes:** Microsoft Teams Trigger -> Azure OpenAI -> Function (compliance regex) -> IF node -> Microsoft Teams / Graph Mail -> HTTP Request (Log Analytics)

**Compliance:** Every draft is logged with the original request, AI
output, compliance scan results, and whether CCO review was triggered.
Prohibited-term list is configurable per firm. Communication
Compliance in Purview also monitors the final sent email independently.

---

### 3. New Client Onboarding Checklist

**The pitch:** When a new client is added to the CRM, DAX automatically
creates a personalized onboarding checklist in SharePoint, drafts the
welcome email, and reminds the advisor of every required document — so
nothing falls through the cracks.

**Trigger:** New contact/account created in CRM (webhook or polling)

**Workflow:**
```
CRM webhook (new client created)
  -> Extract: client name, account type, state of residence, entity type
  -> Azure OpenAI GPT-4o: generate personalized checklist
     Based on: account type (individual/joint/trust/entity),
     state-specific requirements, firm's standard procedures
  -> Create SharePoint list item with checklist
  -> Create SharePoint folder: /Clients/{ClientName}/Onboarding/
  -> Draft welcome email via GPT-4o (personalized to account type)
  -> Send welcome email to advisor for review (not directly to client)
  -> Create follow-up tasks in CRM (day 1, 7, 30 reminders)
  -> Log to Log Analytics
```

**n8n nodes:** Webhook (CRM) -> Azure OpenAI -> SharePoint (create list + folder) -> Azure OpenAI (welcome email) -> Graph Mail -> HTTP Request (CRM tasks) -> HTTP Request (Log Analytics)

**Compliance:** Onboarding checklist includes all required regulatory
documents (Form ADV Part 2A delivery, privacy notice, advisory
agreement). Checklist completion is tracked in SharePoint with
timestamps. AI-generated welcome email is logged and flagged for
advisor review before sending — never auto-sent to clients.

---

### 4. ADV Disclosure Document Monitor

**The pitch:** DAX watches the SEC EDGAR feed for your firm's ADV
filings and competitor updates, summarizes material changes, and
alerts the CCO when your own ADV is due for its annual amendment —
so you never miss a filing deadline.

**Trigger:** Weekly schedule (Mondays 7 AM) + annual reminder (90 days
before ADV amendment deadline)

**Workflow:**
```
Schedule trigger (weekly)
  -> HTTP Request: SEC EDGAR API for firm's CRD number
  -> HTTP Request: SEC EDGAR for competitor/peer firm filings
  -> Azure OpenAI GPT-4o: summarize changes
     "Compare this ADV amendment to the previous version.
      Highlight material changes in: fees, conflicts of interest,
      disciplinary history, and business practices."
  -> If material changes found: email summary to CCO
  -> If annual deadline approaching: create compliance task
  -> Log to Log Analytics

Schedule trigger (annual - 90/60/30 day reminders)
  -> Email CCO: ADV annual amendment deadline reminder
  -> Create task in CRM compliance workflow
  -> Log to Log Analytics
```

**n8n nodes:** Schedule Trigger -> HTTP Request (EDGAR) -> Azure OpenAI -> IF node -> Graph Mail -> HTTP Request (Log Analytics)

**Compliance:** All EDGAR checks and AI summaries logged. The
automation never files or modifies ADV documents — it only monitors
and alerts. CCO retains full control over the filing process.

---

### 5. Compliance Communication Scanner

**The pitch:** Every night, DAX reviews the day's client-facing emails
for regulatory red flags — performance guarantees, misleading claims,
missing disclosures — and sends the CCO a morning report with anything
that needs attention.

**Trigger:** Nightly schedule (11 PM)

**Workflow:**
```
Schedule trigger (nightly)
  -> Graph API: fetch all sent emails from advisory team
     (filtered by: sent to external recipients, today's date)
  -> For each email batch (10 at a time):
     -> Azure OpenAI GPT-4o: compliance review
        System prompt: "Review this client communication for:
          1. Performance guarantees or promissory language
          2. Missing material disclosures
          3. Testimonial rule violations (SEC Marketing Rule)
          4. Cherry-picked performance data
          5. Misleading or exaggerated claims
          Rate each issue: HIGH / MEDIUM / LOW risk.
          If no issues found, respond 'CLEAN'."
  -> Aggregate results
  -> If any HIGH/MEDIUM findings:
     -> Generate HTML report with excerpts and recommendations
     -> Email to CCO
  -> Log all scan results to Log Analytics (including CLEAN)
```

**n8n nodes:** Schedule Trigger -> Microsoft Graph (list messages) -> SplitInBatches -> Azure OpenAI -> Merge -> IF node -> Graph Mail -> HTTP Request (Log Analytics)

**Compliance:** This is a compliance tool, not a substitute for the
CCO's judgment. Every email is scanned and the result (clean or
flagged) is logged. The CCO receives actionable findings, not
auto-corrections. Complements (not replaces) Purview Communication
Compliance policies from Phase 1.

---

### 6. Portfolio Review Summary Generator

**The pitch:** After a quarterly portfolio review, DAX takes the
raw performance data and generates a client-ready summary letter
that explains what happened, why, and what's next — in plain
English, not financial jargon.

**Trigger:** Advisor uploads performance report to SharePoint folder
or sends to a designated email address

**Workflow:**
```
SharePoint file trigger (new file in /Reviews/ folder)
  or Outlook rule (attachment to reviews@ address)
  -> Extract file (PDF/Excel)
  -> Azure OpenAI GPT-4o (with file content):
     "Generate a client-facing quarterly review summary from this
      performance report. Include:
      - Portfolio performance vs. benchmark (no cherry-picking)
      - Asset allocation changes and rationale
      - Market context (factual, not predictive)
      - Action items for next quarter
      - Required disclosures: past performance disclaimer,
        benchmark description, fee impact note
      Tone: professional but accessible. Avoid jargon.
      DO NOT include forward-looking performance predictions."
  -> Compliance scan: verify disclosures are present
  -> Save draft to SharePoint: /Clients/{name}/Reviews/
  -> Notify advisor via Teams: "Review summary ready for your review"
  -> Log to Log Analytics
```

**n8n nodes:** SharePoint Trigger -> Read Binary File -> Azure OpenAI -> Function (disclosure check) -> SharePoint (save) -> Microsoft Teams -> HTTP Request (Log Analytics)

**Compliance:** Generated summaries always include required
performance disclosures (past performance disclaimer, benchmark
disclosure, net-of-fees note). AI is instructed to never make
forward-looking statements. Every generated summary is logged
with the source data hash for audit reconstruction.

---

### 7. Regulatory Filing Deadline Tracker

**The pitch:** DAX maintains a master calendar of every SEC, FINRA,
and state regulatory deadline your firm faces — and sends
reminders at 30, 14, and 3 days out so nothing is ever late.

**Trigger:** Daily schedule (7 AM)

**Workflow:**
```
Schedule trigger (daily 7 AM)
  -> Read regulatory calendar from SharePoint list
     (pre-populated with: Form ADV annual amendment, Form PF,
      13F filings, state registration renewals, FINRA fees,
      annual compliance review, privacy notice delivery, etc.)
  -> Calculate days until each deadline
  -> Azure OpenAI GPT-4o: generate contextual reminders
     "For this [filing type] due in [N] days, provide:
      1. Brief description of what's required
      2. Common mistakes to avoid
      3. Estimated preparation time
      4. Link to relevant SEC/FINRA guidance"
  -> Filter: deadlines at 30, 14, 3, and 1 day(s) out
  -> Send reminders to CCO + relevant staff via Teams/email
  -> If 1 day out and not marked complete: escalate to principal
  -> Log to Log Analytics
```

**n8n nodes:** Schedule Trigger -> SharePoint (read list) -> Function (date calc) -> Azure OpenAI -> IF node -> Microsoft Teams / Graph Mail -> HTTP Request (Log Analytics)

**Compliance:** The regulatory calendar is the source of truth, not
the AI. GPT-4o provides helpful context but the deadlines themselves
come from the structured SharePoint list maintained by the CCO.
All reminders and escalations are logged.

---

### 8. Client Document Intake & Classification

**The pitch:** When a client emails documents (tax returns, trust
agreements, account applications), DAX automatically reads them,
classifies them, extracts key data, and files them in the right
SharePoint folder — saving hours of manual filing every week.

**Trigger:** Email to a designated documents@ address, or SharePoint
upload to /Intake/ folder

**Workflow:**
```
Outlook rule / SharePoint trigger (new file in /Intake/)
  -> Extract attachments
  -> Azure OpenAI GPT-4o (vision for scanned docs, text for PDFs):
     "Classify this document as one of:
      TAX_RETURN, TRUST_AGREEMENT, ACCOUNT_APPLICATION,
      BENEFICIARY_FORM, TRANSFER_FORM, COMPLIANCE_DOC,
      FINANCIAL_STATEMENT, INSURANCE_POLICY, OTHER.
      Extract: client name, date, document date, key values.
      Return as JSON."
  -> Parse classification result
  -> Look up client in CRM -> get client folder path
  -> Move file to: /Clients/{ClientName}/{DocType}/
  -> Update CRM: log document received with metadata
  -> If ACCOUNT_APPLICATION or TRANSFER_FORM:
     -> Create task for operations team
  -> Notify advisor: "New [doc type] from [client] filed"
  -> Log to Log Analytics
```

**n8n nodes:** Outlook Trigger -> Extract Attachments -> Azure OpenAI -> Function (parse JSON) -> HTTP Request (CRM lookup) -> SharePoint (move file) -> HTTP Request (CRM update) -> IF node -> Microsoft Teams -> HTTP Request (Log Analytics)

**Compliance:** Original documents are never modified. Classification
metadata and AI extraction results are logged separately. Documents
are retained in SharePoint with versioning enabled. The automation
files but does not delete — misclassified documents can be corrected
by staff.

---

### 9. AUM & Fee Billing Reconciliation

**The pitch:** Each quarter, DAX pulls your AUM data and fee
schedule, calculates what each client should be billed, compares
it to what was actually charged, and flags any discrepancies —
catching billing errors before clients (or the SEC) do.

**Trigger:** Monthly or quarterly schedule (1st business day)

**Workflow:**
```
Schedule trigger (quarterly, 1st business day)
  -> HTTP Request: pull AUM data from custodian/CRM
  -> Read fee schedule from SharePoint: /Compliance/FeeSchedule.xlsx
  -> Azure OpenAI GPT-4o:
     "Given this AUM data and fee schedule, calculate the expected
      advisory fee for each client account. Compare to the actual
      fees charged. Flag any discrepancy greater than $10 or 0.5bp.
      Consider: tiered fee breakpoints, household aggregation,
      fee waivers, and new-account proration."
  -> Generate discrepancy report (HTML table)
  -> If discrepancies found:
     -> Email to billing team + CCO
     -> Create tasks in CRM for each discrepancy
  -> Save report to SharePoint: /Compliance/BillingReview/
  -> Log to Log Analytics
```

**n8n nodes:** Schedule Trigger -> HTTP Request (custodian API) -> SharePoint (read file) -> Azure OpenAI -> Function (parse results) -> IF node -> Graph Mail -> SharePoint (save report) -> HTTP Request (Log Analytics)

**Compliance:** Fee billing accuracy is a frequent SEC examination
focus. This automation creates a documented, auditable review
process. The AI calculates expected fees but a human reviews and
approves any corrections. All reports are retained in SharePoint
and logged to Log Analytics.

---

### 10. Annual Compliance Review Workpaper Generator

**The pitch:** When it's time for your annual compliance review (Rule
206(4)-7), DAX assembles a first draft of your workpapers by pulling
data from across your systems — turning weeks of preparation into
days.

**Trigger:** Annual schedule (configurable, typically Q4) or manual
trigger via Teams command

**Workflow:**
```
Schedule trigger (annual) or Teams command (@DAX start-acr)
  -> Gather data from multiple sources:
     - SharePoint: policy documents, prior year workpapers
     - CRM: client count, AUM totals, new/lost clients
     - Log Analytics: DAX usage statistics, compliance scan results
     - Email: CCO communication log summaries (via Graph)
  -> For each compliance review section:
     -> Azure OpenAI GPT-4o: draft workpaper section
        Sections: portfolio management, trading, disclosures,
        advertising/marketing, custody, books & records,
        business continuity, cybersecurity, code of ethics
  -> Compile into Word document (using template)
  -> Save to SharePoint: /Compliance/AnnualReview/{Year}/
  -> Create task list for CCO: review/approve each section
  -> Notify CCO via Teams
  -> Log to Log Analytics
```

**n8n nodes:** Schedule/Teams Trigger -> Multiple HTTP Requests (data gathering) -> SplitInBatches -> Azure OpenAI -> Merge -> Function (compile document) -> SharePoint (save) -> Microsoft Teams -> HTTP Request (Log Analytics)

**Compliance:** The annual compliance review is required by Rule
206(4)-7 under the Advisers Act. This automation drafts workpapers
but does not complete the review — the CCO must review, modify,
and approve each section. The draft is clearly marked as
"AI-GENERATED DRAFT — REQUIRES CCO REVIEW AND APPROVAL."
All source data and AI outputs are logged.

---

## Compliance Architecture

### Audit Trail Design

Every automation writes a structured log entry to the client's
Log Analytics workspace (the same one used by DAX Phase 1):

```json
{
  "timestamp": "2026-03-12T14:30:00Z",
  "automationId": "meeting-prep-brief",
  "automationVersion": "1.2",
  "workflowExecutionId": "n8n-exec-12345",
  "trigger": "calendar-event",
  "triggerDetails": {
    "meetingId": "AAMk...",
    "clientName": "John Smith"
  },
  "aiCalls": [
    {
      "model": "gpt-4o",
      "promptTokens": 1250,
      "completionTokens": 890,
      "systemPrompt": "hash:sha256:abc123...",
      "inputSummary": "Client profile + portfolio data",
      "outputSummary": "Meeting brief generated (3 sections)"
    }
  ],
  "complianceFlags": [],
  "outputDestination": "email:advisor@firm.com",
  "status": "completed",
  "durationMs": 4500
}
```

### Retention

- All automation logs: 7 years (Rule 17a-4, same as chat logs)
- Source documents: retained in SharePoint with versioning
- AI-generated outputs: retained in SharePoint + Log Analytics
- n8n execution logs: 90 days in n8n, 7 years in Log Analytics

### Guardrails (applied to all automations)

1. **No autonomous client contact.** Every client-facing output
   (emails, letters, reports) goes to the advisor for review
   before sending. DAX drafts, humans send.

2. **No performance predictions.** System prompts for all
   automations prohibit forward-looking performance statements,
   guaranteed returns, and promissory language.

3. **No autonomous trading.** DAX Automations never places trades,
   transfers money, or modifies account settings.

4. **Required disclosures.** Automations that generate client-facing
   content include required regulatory disclosures automatically.

5. **CCO escalation.** Any compliance flag (HIGH or MEDIUM) routes
   to the CCO via Teams with the relevant context.

6. **Data residency.** All processing happens within the client's
   Azure tenant. No data leaves the compliance boundary.

---

## Technical Infrastructure

### n8n Deployment

n8n runs as a second Container App in the client's Azure tenant,
sharing the existing VNet and private endpoints:

```
Container App: ca-dax-n8n-{clientName}
  Image: n8nio/n8n:latest (or custom with pre-installed nodes)
  VNet: same snet-container-apps subnet as LibreChat
  Database: same Cosmos DB (separate database: dax-n8n)
  Secrets: same Key Vault (n8n-encryption-key, n8n-webhook-url)
  Identity: same managed identity (id-dax-{clientName})
  Logging: same Log Analytics workspace
```

### Credential Management

All automation credentials stored in Azure Key Vault:
- `n8n-encryption-key` — n8n's internal encryption key
- `crm-api-key` — Redtail or Salesforce connected app credentials
- `graph-client-id` / `graph-client-secret` — M365 Graph API access
- Managed identity used for Azure OpenAI (same as DAX Phase 1)

### Network Architecture

```
n8n Container App
  -> Azure OpenAI (via private endpoint, existing)
  -> Cosmos DB (via private endpoint, existing)
  -> Microsoft Graph API (outbound HTTPS)
  -> CRM API (outbound HTTPS)
  -> Log Analytics (via ingestion API)
```

---

## Pricing Model

### Structure: Base + Per-Workflow Bundles

| Tier | Price | What's Included |
|------|-------|-----------------|
| **DAX Core** (Phase 1) | $500/mo | AI chat workspace, SSO, audit logging, 7-year retention |
| **DAX Automations Starter** | +$300/mo | Pick any 3 workflows + n8n hosting + audit logging |
| **DAX Automations Professional** | +$600/mo | All 10 workflows + priority support + quarterly review |
| **DAX Automations Enterprise** | +$1,000/mo | All workflows + custom workflow development (2/quarter) + dedicated Slack channel |

### Usage-Based Component

Azure OpenAI token consumption is passed through at cost + 20% margin:
- GPT-4o: ~$0.0025 per 1K input tokens, ~$0.01 per 1K output tokens
- Typical firm (50 clients): ~$30-80/month in AI usage
- Included in Starter/Professional: up to $50/month AI usage
- Overage billed quarterly at cost + 20%

### Setup Fee

| Tier | One-Time Setup |
|------|---------------|
| Starter | $1,500 |
| Professional | $2,500 |
| Enterprise | $5,000 |

Setup includes: n8n deployment, CRM integration, M365 Graph
permissions, workflow configuration, compliance review with CCO,
and UAT with 2 test workflows.

### Cost to Dakona (per client)

| Item | Monthly Cost |
|------|-------------|
| n8n Container App (0.5 vCPU, 1Gi) | ~$15 |
| Cosmos DB (n8n data, serverless) | ~$5 |
| Azure OpenAI tokens (typical) | ~$30-80 |
| Support labor (amortized) | ~$50-100 |
| **Total cost** | **~$100-200** |
| **Starter margin** | ~50-67% |
| **Professional margin** | ~67-83% |

### Annual Contract Incentive

- Monthly: prices as listed
- Annual prepay: 10% discount
- 2-year commitment: 15% discount + 1 custom workflow included

---

## Implementation Roadmap

### Phase 2a — Foundation (Weeks 1-4)
- Deploy n8n Container App infrastructure (Bicep module)
- Build audit logging framework (shared across all workflows)
- Implement Workflow 1 (Meeting Prep) and Workflow 2 (Email Draft)
- CCO review of compliance guardrails

### Phase 2b — Core Workflows (Weeks 5-8)
- Implement Workflows 3-6
- CRM integration (Redtail API + Salesforce connector)
- SharePoint document management integration
- Beta testing with 2 pilot firms

### Phase 2c — Advanced Workflows (Weeks 9-12)
- Implement Workflows 7-10
- Custodian data integration
- Annual compliance review template library
- Production launch for Starter and Professional tiers

---

## Appendix: Workflow Quick Reference

| # | Workflow | Trigger | AI Calls | Output |
|---|----------|---------|----------|--------|
| 1 | Meeting Prep Brief | Calendar (15 min before) | 1 | Email to advisor |
| 2 | Email Draft & Review | Teams/email | 1-2 | Draft + compliance scan |
| 3 | New Client Onboarding | CRM (new contact) | 2 | SharePoint + email + tasks |
| 4 | ADV Monitor | Weekly schedule | 1 | Alert to CCO |
| 5 | Communication Scanner | Nightly schedule | N (batch) | Morning report to CCO |
| 6 | Portfolio Review Summary | SharePoint upload | 1 | Draft letter in SharePoint |
| 7 | Filing Deadline Tracker | Daily schedule | 1 | Reminders via Teams/email |
| 8 | Document Intake | Email/SharePoint | 1 | Classified + filed docs |
| 9 | Fee Billing Reconciliation | Quarterly schedule | 1 | Discrepancy report |
| 10 | Annual Review Workpapers | Annual/manual | 8-10 | Draft workpapers in SharePoint |
