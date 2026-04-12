# TASK-1ALTX-001 Results — Redesign n8n 7B: Pure Scorer (Claude Sonnet)

**Status:** DONE
**Completed:** 2026-04-12
**Agent:** FORGE

## Summary

Workflow `vuzR69FaM306OVWK` ("1AltX 07B: Deep GPT Analyzer") has been redesigned as
"1AltX 07B: Pure Scorer (Claude Sonnet)".

## Changes Made

### 1. Build Anthropic Request (was: Build OpenAI Request)
- Replaced o4-mini prompt with new Pure Scorer prompt
- New prompt scores on two axes: Job Fit (0-10) + Client Quality (0-10) = Combined (0-20)
- Added budget filter ($30/hr min hourly, $200 min fixed)
- Added new fields: richard_fit_tag, engagement_type, competitive_difficulty, priority_flag
- Added tool flags: n8n, airtable, twilio, hubspot
- Removed cover letter generation entirely
- Model: claude-sonnet-4-5-20250514, max_tokens: 1024

### 2. Anthropic API Call (was: OpenAI API Call)
- URL: https://api.anthropic.com/v1/messages
- Auth: httpHeaderAuth credential (id: vayh9kFZH9BfJFdU, "Anthropic API Key")
- Headers: anthropic-version: 2023-06-01, content-type: application/json
- API key sourced from Azure Key Vault (secret: anthropic-api-key)

### 3. Parse Anthropic Response (was: Parse OpenAI Response)
- Updated to parse Anthropic response format: content[0].text (not choices[0].message.content)
- Token counting updated: input_tokens + output_tokens (not usage.total_tokens)

### 4. Map Fields to Sheet
- Confidence Score ← combined_score (was confidence_score)
- Notes ← notes (new field, was unused)
- Cover Letter ← '' (cleared, no longer generated)
- All existing columns preserved: MatchingProject, MakeCom, Google Sheets, Google Docs, Gmail, ChatGPT, GoogleDrive, Other, Status, Proposed Rate, Processed
- New columns NOT yet mapped (need manual addition to sheet first): Job Fit Score, Client Quality Score, Engagement Type, Competitive Difficulty, Priority Flag, Richard Fit Tag, n8n, Airtable, Twilio, HubSpot

## What Was NOT Changed
- Google Sheet document ID and sheet tab (UpWork_Log)
- Filter Unprocessed Rows logic
- Schedule trigger (every 15 min)
- Batch loop structure (Split In Batches → process → Update Sheet → loop)
- Parse Success? routing
- Update Google Sheet node (auto-map by column name)

## Credential Setup
- Created n8n credential: "Anthropic API Key" (httpHeaderAuth, id: vayh9kFZH9BfJFdU)
- API key retrieved from Azure Key Vault: kvdaxdakonapilot / anthropic-api-key

## Test Results
- Workflow deployed and active
- Schedule trigger firing every 15 min
- Post-deploy execution 28717: SUCCESS (no unprocessed rows — all 189 rows already processed)
- Full Anthropic scoring will activate on next new unprocessed row in the sheet

## Next Steps for Richard
- Add new columns to the Google Sheet (UpWork_Log tab) when ready:
  Job Fit Score, Client Quality Score, Combined Score, Engagement Type, Competitive Difficulty, Priority Flag, Richard Fit Tag, n8n, Airtable, Twilio, HubSpot
- Then update Map Fields to Sheet node to include new column mappings
- Enable the Upwork API key on Upwork developer portal (currently Disabled)
