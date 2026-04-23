# LeadLUX — Canonical Lead Systems Architecture (Phase 1 Spec)

**Client:** Gabriel Lewis (LeadLUX)
**Contract:** $1,650 fixed — complete Phase 1 deliverable due Sun Apr 26, 2026
**Payment structure:** $1,150 released on delivery + $500 turnover/acceptance payment released on handoff sign-off
**Version:** Draft v0.1 — started Apr 23, 2026
**Author:** Richard Mabbun, 1AltX LLC

---

## 0. Design Principles

This system is designed around four non-negotiable principles that inform every downstream decision:

1. **Consent is a state, not a workflow.** A lead's eligibility to be contacted on any channel is determined by the consent record, not by the automation that happens to be running. The routing engine queries consent state; it does not infer it.
2. **Every delivery is an append-only event.** Nothing gets overwritten. Nothing gets "cleaned up." The audit trail is the product.
3. **Source-of-truth lives in the canonical record.** The CRM is an execution layer. If the CRM burns down, the canonical record rebuilds it. Never the other way around.
4. **Lane is determined once, then locked.** Routing rules reference `lane_confirmed` only — never the intake signal. A seller lead cannot become a buyer lead because a field got re-typed.

---

## 1. Canonical Lead Object Schema

### 1.1 Identity & Dedup

| Field | Type | Notes |
|---|---|---|
| `lead_id` | UUID | Primary key. Generated at intake. Immutable. |
| `dedup_hash` | SHA-256 | `sha256(normalize(phone) + normalize(email))`. Evaluated **before** any state write. |
| `created_at` | timestamp | Immutable. |
| `updated_at` | timestamp | System-managed. |

### 1.2 Source & Attribution

| Field | Type | Notes |
|---|---|---|
| `source_type` | enum | `google_ads`, `meta_ads`, `open_house`, `referral`, `inbound_call`, `manual_import`, `organic_web` |
| `source_channel_status` | enum | `active`, `inactive` — lets Meta be defined but gated off in Phase 1 |
| `gclid` | string | First-class field. If missing on a Google Ads lead, the feedback loop is broken by design — log and flag. |
| `utm_source` / `utm_medium` / `utm_campaign` / `utm_content` / `utm_term` | string | Standard. |
| `intake_url` | string | Landing page URL. |
| `intake_ip` | string | For consent record. |
| `intake_method` | enum | `web_form`, `inbound_call_verbal`, `manual_entry`, `api_import` — drives consent capture rules. |

### 1.3 Lane Classification

| Field | Type | Notes |
|---|---|---|
| `lane_signal` | enum | Soft signal from intake source. Never used for routing decisions. |
| `lane_confirmed` | enum | `seller_distressed`, `seller_traditional`, `buyer_retail`, `buyer_investor`, `borrower_mortgage`, `iul_prospect` (reserved) |
| `lane_lock` | boolean | Set to `true` when `lane_confirmed` is written. Subsequent lane writes logged as `cross_lane_flag` but do not re-route. |

### 1.4 Qualification State

| Field | Type | Notes |
|---|---|---|
| `qualification_score` | integer | 0–100. Written by AI caller or qualification logic. |
| `exclusive_eligible` | boolean | Gates exclusive-offer routing. |
| `appointment_set` | boolean | Gates highest-value conversion event. |
| `appointment_datetime` | timestamp | Null if not set. |
| `state` | enum | See Section 3 (State Machine). |
| `state_version` | integer | Optimistic lock. Incremented on every state write. |

### 1.5 Monetization Tracking

| Field | Type | Notes |
|---|---|---|
| `resale_event_count` | integer | Atomic increment. Enforced against `resale_cap` at state machine level. |
| `resale_cap` | integer | Configurable per lane / consent scope. Default: 3. |
| `exclusive_buyer_id` | FK | Null until assigned. |
| `exclusive_offered_at` | timestamp | Null until offered. |
| `exclusive_resolution` | enum | `accepted`, `rejected`, `expired`, null |

---

## 2. Consent Record Structure

Consent is an **immutable event log** with one-to-many relationship to the lead. Never a field on the lead itself.

### 2.1 Consent Record Fields

| Field | Type | Notes |
|---|---|---|
| `consent_id` | UUID | Primary key. |
| `lead_id` | FK | References canonical lead. |
| `channel` | enum | `sms`, `call`, `email` — **one record per channel**, never combined. |
| `granted` | boolean | `true` = opt-in, `false` = opt-out/revoke. |
| `consent_text_version` | string | Version hash of the exact text shown at the moment of capture. |
| `consent_text_content` | text | The actual text (immutable copy). |
| `capture_method` | enum | `web_form_checkbox`, `web_form_implicit`, `verbal_recorded`, `verbal_transcribed`, `written_signature`, `api_import_with_proof` |
| `captured_at` | timestamp | Immutable. |
| `captured_ip` | string | Nullable for non-web methods. |
| `captured_source_url` | string | Nullable for non-web methods. |
| `proof_artifact_url` | string | Recording URL, screenshot URL, signed doc URL. |

### 2.2 Consent Gate Logic (referenced by every delivery attempt)

Before any delivery — exclusive or resale — the routing engine checks:

1. Does an active consent record exist for this `lead_id` + `channel`?
2. Is the consent record the most recent for that channel (i.e., not superseded by a later opt-out)?
3. Does the consent scope permit this buyer tier? (Some consents are broad; some are buyer-specific.)
4. Has `resale_event_count` reached `resale_cap`?

If **any** check fails, delivery is **blocked and logged** — never silently dropped.

### 2.3 Capture Rules by Intake Method

| Intake Method | Required Proof |
|---|---|
| `web_form` | IP + timestamp + source URL + checkbox state + exact text version |
| `inbound_call_verbal` | Call recording URL + transcript + timestamp + agent ID |
| `manual_entry` | Staff ID + method of original capture + proof artifact link |
| `api_import` | Source system ID + original capture proof + import timestamp |

---

## 3. State Machine

### 3.1 States

```
NEW
  ↓
INTAKE_COMPLETE
  ↓
QUALIFYING
  ↓
QUALIFIED ──────────────────────────┐
  ↓                                 ↓
EXCLUSIVE_OFFERED              NURTURE (parallel)
  ↓         ↓
EXCLUSIVE_  EXCLUSIVE_EXPIRED
ACCEPTED        ↓
(terminal)  RESALE_ELIGIBLE
                ↓
            RESALE_IN_PROGRESS
                ↓
            RESALE_DELIVERED ──┐
                ↓              ↓ (loop until cap)
            RESALE_EXHAUSTED

SUPPRESSED (parallel — can be entered from any state via opt-out)
```

### 3.2 Transition Rules

| From | To | Condition | Side Effects |
|---|---|---|---|
| `NEW` | `INTAKE_COMPLETE` | Required fields present + dedup_hash unique | Create consent record(s) |
| `INTAKE_COMPLETE` | `QUALIFYING` | Qualification process started (AI caller dispatched or manual assigned) | Log qualification start event |
| `QUALIFYING` | `QUALIFIED` | Qualification complete AND `lane_confirmed` written AND `lane_lock = true` | — |
| `QUALIFYING` | `NURTURE` | Qualification complete but not yet ready for routing | — |
| `QUALIFIED` | `EXCLUSIVE_OFFERED` | `exclusive_eligible = true` AND eligible buyer in lane queue | Write `exclusive_buyer_id`, start timeout |
| `EXCLUSIVE_OFFERED` | `EXCLUSIVE_ACCEPTED` | Buyer accept response received within timeout | Terminal — fire `exclusive_delivered` conversion |
| `EXCLUSIVE_OFFERED` | `EXCLUSIVE_EXPIRED` | Buyer reject OR timeout (default 15 min) | — |
| `EXCLUSIVE_EXPIRED` | `RESALE_ELIGIBLE` | Consent scope permits resale | — |
| `RESALE_ELIGIBLE` | `RESALE_IN_PROGRESS` | Next buyer endpoint selected from queue | Lock endpoint |
| `RESALE_IN_PROGRESS` | `RESALE_DELIVERED` | Delivery accepted by endpoint | Increment `resale_event_count`, fire event |
| `RESALE_DELIVERED` | `RESALE_ELIGIBLE` | `resale_event_count < resale_cap` AND more endpoints available | Loop |
| `RESALE_DELIVERED` | `RESALE_EXHAUSTED` | `resale_event_count >= resale_cap` OR no endpoints left | Terminal |
| `*` | `SUPPRESSED` | Opt-out received on any channel with scope = all | Block all future delivery |

### 3.3 Race Condition Prevention

Every state transition writes `state_version + 1`. If the underlying record has already moved past the expected version, the transition **fails and logs** — it does not retry silently or duplicate.

---

## 4. Routing Logic — Abstracted Buyer Endpoints

### 4.1 Buyer Endpoint Record

| Field | Type | Notes |
|---|---|---|
| `endpoint_id` | UUID | |
| `endpoint_name` | string | Human-readable. |
| `delivery_method` | enum | `api_post`, `webhook`, `email`, `crm_push`, `marketplace_api` |
| `endpoint_config` | JSON | Method-specific (URL, auth, field mapping). |
| `lane_scope` | array<enum> | Which lanes this endpoint accepts. |
| `tier` | enum | `exclusive_primary`, `exclusive_secondary`, `resale_tier_1`, `resale_tier_2`, `resale_tier_3`, `marketplace` |
| `active` | boolean | On/off switch without structural change. |
| `priority` | integer | Lower = higher priority within tier. |
| `price_per_lead` | decimal | For yield calculation. |

### 4.2 Routing Resolution

The engine resolves the next eligible endpoint by:

1. Filter endpoints where `active = true`
2. Filter endpoints where `lane_scope` contains the lead's `lane_confirmed`
3. Filter endpoints not already delivered to for this lead (check event log)
4. Sort by `tier` priority, then `priority` within tier
5. Take top endpoint
6. Run consent gate (Section 2.2)
7. If pass → deliver. If fail → log and try next endpoint.

**Switching from marketplace to direct buyer is a configuration change**, not a structural one: flip `active` flags, adjust `priority`. The state machine and consent logic don't change.

---

## 5. Event Log / Audit Trail

### 5.1 Event Record

| Field | Type | Notes |
|---|---|---|
| `event_id` | UUID | |
| `lead_id` | FK | |
| `event_type` | enum | See 5.2 |
| `event_timestamp` | timestamp | Immutable. |
| `actor` | string | System component or user ID. |
| `payload` | JSON | Event-specific data. |
| `result` | enum | `success`, `failure`, `blocked`, `timeout` |
| `failure_reason` | string | Nullable. |

### 5.2 Event Types (non-exhaustive)

- `intake_received`
- `dedup_check`
- `consent_captured`
- `state_transition`
- `qualification_started`
- `qualification_completed`
- `routing_attempt`
- `consent_gate_check`
- `delivery_success`
- `delivery_rejected`
- `delivery_timeout`
- `resale_cap_reached`
- `conversion_event_fired`
- `cross_lane_flag`

Every event is append-only. No updates, no deletes.

---

## 6. CRM Field Mapping — Source-of-Truth vs Execution Layer

The canonical record (Airtable, or equivalent if volume dictates Supabase) is **source-of-truth**. The CRM (leaning GHL per discovery) is an **execution layer** — it runs workflows, houses conversation history, and renders the interface operators use. The CRM is not authoritative on any canonical field.

### 6.1 Mapping Direction Rules

| Direction | Meaning | Example |
|---|---|---|
| `canonical → crm` | Canonical writes, CRM reads. CRM cannot overwrite. | `lead_id`, `lane_confirmed`, `state`, `consent` records |
| `crm → canonical` | CRM writes, canonical records as event. CRM value becomes the new canonical value only after event log write succeeds. | `qualification_score` (from human operator), `appointment_set` (from manual booking) |
| `bidirectional_mirrored` | Both sides can originate, but writes always go through canonical first, then sync to CRM. Last-write-wins is forbidden. | `contact_name`, `phone`, `email` — corrections allowed but logged |
| `crm_only` | Execution-layer data that doesn't belong in canonical. | Conversation history, pipeline stage UI labels, internal notes |

### 6.2 Canonical ↔ GHL Field Mapping Table

| Canonical Field | GHL Field | Direction | Conflict Resolution |
|---|---|---|---|
| `lead_id` | `customField.canonical_lead_id` | canonical → crm | Canonical wins always; GHL value if differs = log `integrity_violation` |
| `source_type` | `customField.source_type` | canonical → crm | Canonical wins; immutable after intake |
| `gclid` | `customField.gclid` | canonical → crm | Canonical wins; immutable after intake |
| `lane_confirmed` | `tag` (lane tags) + `customField.lane_confirmed` | canonical → crm | Canonical wins; `lane_lock` prevents changes |
| `state` | `pipelineStageId` | canonical → crm | Canonical wins; GHL pipeline stage changes must emit webhook → canonical validates → canonical updates both |
| `qualification_score` | `customField.qualification_score` | crm → canonical | CRM updates allowed; every change logged as event |
| `appointment_set` | `opportunity.hasAppointment` | crm → canonical | CRM write triggers webhook → canonical updates → fires conversion event |
| `appointment_datetime` | `calendar.eventTime` | crm → canonical | Same as above |
| `consent.*` | *(not mapped)* | canonical only | Consent lives in canonical only. GHL cannot read or write consent records. This is intentional. |
| `resale_event_count` | *(not mapped)* | canonical only | Never exposed to CRM operators. Delivery decisions are not CRM operator decisions. |
| `exclusive_buyer_id` | `customField.exclusive_buyer_name` (display only) | canonical → crm | Display only; operators cannot change buyer assignment from CRM |
| `contact_name` | `contact.name` | bidirectional_mirrored | CRM edit → webhook → canonical validates → canonical updates → syncs back |
| `phone` | `contact.phone` | bidirectional_mirrored | Same as above; phone change triggers dedup re-evaluation |
| `email` | `contact.email` | bidirectional_mirrored | Same as above |
| *(none)* | `conversation.*`, `note.*`, `internalComment.*` | crm_only | Execution-layer only; never promoted to canonical |

### 6.3 Integrity Guarantees

1. **Canonical write is the commit.** The CRM sync is eventually-consistent and allowed to fail. If GHL is down, the canonical record is still authoritative; the sync layer retries.
2. **Webhook failures are logged, not swallowed.** If GHL fails to receive a canonical update, the event log captures the failure. Downstream reconciliation is possible because canonical holds the truth.
3. **CRM migration is a rebuild, not a data rescue.** If you replace GHL with HubSpot, you rebuild the execution layer from canonical. No data is trapped in the CRM.

---

## 7. AI Caller I/O Field Spec

### 7.1 Caller Inputs (canonical → caller at dispatch)

| Field | Type | Purpose |
|---|---|---|
| `lead_id` | UUID | Required. Used on every write-back. |
| `phone` | E.164 string | Number to dial. |
| `contact_name` | string | Personalization. |
| `source_type` | enum | Informs caller script branching. |
| `lane_signal` | enum | Hint for call intent; caller confirms or overrides to `lane_confirmed`. |
| `intake_context` | JSON | Form field values, UTM terms, inbound call recording, or referral source notes. |
| `consent_summary` | JSON | Which channels are consented, for what scope. Caller uses this to verify during the call. |
| `call_attempt_number` | integer | First call vs retry — script branches accordingly. |

### 7.2 Caller Outputs (caller → canonical on every attempt, regardless of outcome)

| Field | Type | Validation | Notes |
|---|---|---|---|
| `call_outcome` | enum | Required; closed enum: `connected_qualified`, `connected_disqualified`, `connected_not_interested`, `voicemail_left`, `no_answer`, `wrong_number`, `do_not_call_requested`, `busy`, `call_failed` | Drives retry logic and state transition. |
| `lane_confirmed` | enum | Required if `call_outcome = connected_qualified`; closed enum matching lead object schema | Triggers `lane_lock`. |
| `qualification_score` | integer | 0–100; required if connected | Routing input #3. |
| `exclusive_eligible` | boolean | Required if connected | Routing input #1 — gates exclusive offer flow. |
| `appointment_set` | boolean | Required | Routing input #2 — triggers highest-value conversion event. |
| `appointment_datetime` | ISO 8601 timestamp | Required if `appointment_set = true`; nullable otherwise | — |
| `intent_signals` | array<string> | Free-text array from closed taxonomy | e.g., `["motivated_seller", "cash_buyer_ready", "pre_approved_mortgage"]`. Taxonomy defined in §7.4. |
| `disqualifying_signals` | array<string> | Free-text array from closed taxonomy | e.g., `["already_listed", "not_decision_maker", "timeline_too_long"]`. |
| `key_objections` | array<string> | Free-text array | Verbatim or paraphrased for training/review. |
| `call_recording_url` | string | Required if connected | Consent proof for verbal grants. |
| `call_transcript` | text | Required if connected | For audit + qualification review. |
| `caller_agent_id` | string | Required | Which AI caller version/model handled this — tracks performance across versions. |
| `call_duration_seconds` | integer | Required | Cost attribution + quality signal. |
| `call_attempt_timestamp` | timestamp | Required | Write time. |

### 7.3 Routing-Critical Fields (the three that decide everything)

1. **`exclusive_eligible`** — gates entry into `EXCLUSIVE_OFFERED` state.
2. **`appointment_set`** — triggers the highest-value conversion event to Google Ads.
3. **`qualification_score`** — orders resale queue priority when `exclusive_eligible = false`.

Every other field is informational or audit. These three are the decision surface.

### 7.4 Signal Taxonomies (closed enums to prevent caller drift)

**Intent signals:**
`motivated_seller`, `timeline_under_90_days`, `cash_buyer_ready`, `pre_approved_mortgage`, `decision_maker_confirmed`, `property_condition_acceptable`, `budget_confirmed`, `location_confirmed`

**Disqualifying signals:**
`already_listed`, `already_under_contract`, `not_decision_maker`, `timeline_too_long`, `budget_insufficient`, `location_mismatch`, `duplicate_contact`, `do_not_call_list`, `hostile_response`

Extending the taxonomy is allowed but requires a canonical schema version bump — not a caller-side change.

### 7.5 Validation & Error Handling

- All caller outputs validate against this spec on write. Invalid payloads are rejected, the attempt is logged as `call_failed`, and the lead stays in `QUALIFYING` for retry.
- Missing required fields = rejection. Partial writes are not allowed.
- The caller must be idempotent on retry: writing the same `(lead_id, call_attempt_timestamp)` twice produces one canonical event, not two.

---

## 8. Google Ads Conversion Event Mapping (GCLID Feedback Loop)

### 8.1 The Non-Negotiable

**GCLID must be captured at intake.** If a Google Ads lead enters the system without GCLID, the feedback loop is broken for that lead — permanently. The landing page's form submission must pass GCLID as a hidden field, and the canonical record writes it immediately. Missing GCLID on a Google Ads source lead is a `system_integrity` event, not a user error.

### 8.2 Conversion Event Map

Google Ads Smart Bidding optimizes on whatever events you send it. Sending only `lead_submitted` events teaches Smart Bidding to find people who fill out forms. Sending `contract_signed` events teaches it to find people who close. The event map below is designed so Smart Bidding learns on actual economic outcomes, not top-of-funnel noise.

| Canonical Event | Google Ads Conversion Action | Trigger | Attributed Value |
|---|---|---|---|
| `lead_qualified` | `LeadLUX - Qualified Lead` | State → `QUALIFIED` | $25 (configurable; reflects qualified-lead internal cost-per-acquisition floor) |
| `exclusive_delivered` | `LeadLUX - Exclusive Delivered` | State → `EXCLUSIVE_ACCEPTED` | `price_per_lead` of receiving buyer |
| `appointment_set` | `LeadLUX - Appointment Set` | `appointment_set = true` | $75 (configurable; reflects appointment-to-close rate × expected revenue) |
| `contract_signed` | `LeadLUX - Contract Signed` | Manual trigger from mortgage ops / partner confirmation | Actual contract commission value |
| `deal_funded` | `LeadLUX - Deal Funded` | Manual trigger from mortgage ops / partner confirmation | Actual funded commission value (highest-value signal; what Smart Bidding should optimize toward) |

### 8.3 Payload Structure (Google Ads Offline Conversions API)

Every conversion event fires via webhook to the Google Ads Offline Conversions API with:

```json
{
  "gclid": "<from canonical record>",
  "conversion_action": "<action name from §8.2>",
  "conversion_date_time": "<ISO 8601>",
  "conversion_value": <decimal>,
  "currency_code": "USD",
  "order_id": "<lead_id>"
}
```

### 8.4 Firing Rules

1. **Events fire on state transition**, not on webhook replay. The state machine emits the event once; the event log records it once.
2. **Events are idempotent by `order_id` (lead_id).** Google Ads deduplicates on `order_id + conversion_action`. Re-firing the same conversion on the same lead is safe but wasteful.
3. **Failed fires are retried with exponential backoff.** Up to 5 attempts over 24 hours, then logged as `conversion_fire_failed` — that's a canonical event that can be manually resolved.
4. **Retroactive conversions are supported.** `contract_signed` and `deal_funded` can fire weeks after the original click. As long as the GCLID is still in Google's attribution window (typically 90 days), the event attributes correctly.

### 8.5 Economic Value Model

The values in §8.2 are starting defaults. They should be reviewed quarterly and adjusted based on:
- Actual conversion rates at each stage
- Actual commission realized per funded deal
- Cost-per-acquisition targets by lane

**Phase 1 delivers the structure, not the final numbers.** Gabriel's ad operator tunes values after 30–60 days of signal collection.

---

## 9. Delivery Package

Sunday Apr 26 handoff includes:

1. This document (canonical architecture spec) — PDF + markdown source
2. Field mapping tables — standalone spreadsheet for engineering reference
3. State machine diagram — visual flowchart (PNG + editable source)
4. Video walkthrough (AutoVid/Descript) — full narration of the spec, design decisions, and open configuration questions
5. Open Questions / Decisions log — §10 below, for Gabriel to answer before build starts

---

## 10. Open Questions for Gabriel

These need answers before the CRM architect and AI caller builder start work. They don't block Phase 1 delivery — they're deliberate configuration decisions, not spec gaps.

- **Default `resale_cap` per lane?** Proposed: 3 for seller lanes, 5 for buyer lanes. Configurable per buyer tier.
- **Default exclusive-offer timeout?** Proposed: 15 minutes. Configurable per lane.
- **IUL lane:** reserve `lane_confirmed` enum value now (recommended — zero cost) or defer until activation?
- **Initial marketplace endpoints in scope?** Which marketplaces are you planning to route through first?
- **Manual entry workflow:** web UI (custom form) or direct Airtable entry? Affects consent capture rules and operator training.
- **Conversion values (§8.2):** are the starting defaults acceptable for Week 1, with tuning after real data?
- **Retroactive conversion window:** GCLID attribution typically expires at 90 days — is that long enough for your expected lead-to-fund timeline?

---
