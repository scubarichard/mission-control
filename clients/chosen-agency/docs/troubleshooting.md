# Chosen Agency — V1 Troubleshooting Guide

**Version:** V1  
**Last Updated:** 2026-05-01  
**Format:** Symptom → Diagnosis → Fix  

Issues documented during CHOSEN-004 and CHOSEN-005 build sessions (2026-04-30 / 2026-05-01).

---

## 1. Module 5 fails with "imageDetail" error

**Symptom:** OpenAI Script generation module (M5) throws an error referencing `imageDetail` or unexpected parameter schema.

**Diagnosis:** The OpenAI module was configured with an image-related parameter (`imageDetail`) that doesn't apply to `gpt-4o` text completions. This causes schema validation to fail before the request even reaches OpenAI.

**Fix:** Remove the `imageDetail` parameter from M5's module configuration. In Make, edit M5 (openai-gpt-3:CreateCompletion) and delete any image-related fields. Only keep `model`, `messages`, `max_tokens`, `temperature`, `response_format`.

---

## 2. Module 23 fails with "parseJSON not found" error

**Symptom:** OpenAI Editor Brief module (M23) fails, error mentions `parseJSON` function not available or module output can't be parsed downstream.

**Diagnosis:** The editor brief response comes back as a JSON string inside the OpenAI completion text. Attempting to parse it inline using a Make formula (`parseJSON(...)`) fails because the function isn't available in that context.

**Fix:** Add a separate `json:ParseJSON` module (M30) immediately after M23. Feed M23's text output into M30 as the input. Downstream modules should reference M30's output fields, not M23's raw text.

---

## 3. Module 23 fails: "max_tokens expected integer"

**Symptom:** OpenAI Editor Brief module (M23) throws a type error referencing `max_tokens`.

**Diagnosis:** The `max_tokens` parameter was set as a string value (e.g. `"2000"`) instead of an integer. Make passes it as a string to the OpenAI API which rejects it.

**Fix:** In M23's configuration, ensure `max_tokens` is set as an integer (number type), not a string. Also check `temperature` (should be a double/float like `0.7`) and `n_completions` (integer). Never wrap these in quotes in Make module fields.

---

## 4. Module 30 fails: "Source is not valid JSON"

**Symptom:** The ParseJSON module (M30) after M23 throws "Source is not valid JSON" or similar.

**Diagnosis:** The OpenAI editor brief response is a completion text that may include markdown code fences (` ```json ... ``` `) or extra text before/after the JSON object. The raw text is not clean JSON.

**Fix:** Ensure M23 uses `response_format: { type: "json_object" }` (OpenAI structured output mode). This forces OpenAI to return clean JSON without markdown wrappers. Also verify the system prompt instructs the model to respond only with JSON — no preamble or explanation.

---

## 5. Module 7 fails: "Invalid control character"

**Symptom:** ElevenLabs audio generation module (M7) fails with an error about invalid control characters in the request body.

**Diagnosis:** The script text from M29 (or M5) contains newline characters (`\n`) or other control characters. The ElevenLabs API's JSON body parser rejects these as invalid within a JSON string value.

**Fix:** In M7's body mapper, wrap the script text reference with Make's `replace()` function to strip newlines:
```
replace(29.script; (newline); " ")
```
This replaces newline characters with spaces before sending to ElevenLabs.

---

## 6. Module 7 fails: "404 Not Found"

**Symptom:** ElevenLabs request returns 404.

**Diagnosis:** The `voice_id` used in the ElevenLabs URL is incorrect, doesn't exist in the account, or the URL path is wrong.

**Fix:** Verify the voice ID in System Settings tab (`Default Voice ID` row) is valid for the ElevenLabs account being used. Check the ElevenLabs API URL format: `https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`. The `effective_voice_id` variable must resolve to a real voice ID — check M2's variable resolution chain (col P → col G → default).

---

## 7. Module 10 fails: "401 Unauthorized" (HeyGen)

**Symptom:** HeyGen video creation module (M10) returns 401 Unauthorized.

**Diagnosis:** The HeyGen API key in M10's `X-Api-Key` header is invalid, expired, or missing.

**Fix:** Regenerate the HeyGen API key in the HeyGen account dashboard. Update the `X-Api-Key` header value in M10, M14, and (when created) Render Checker M2. All three must use the same key.

---

## 8. Polling never completes / scenario hangs

**Symptom:** The V1 scenario runs but never reaches Status=Done. It processes through OpenAI and ElevenLabs, but the repeater loop (M12) runs all 30 iterations without completing.

**Diagnosis:** HeyGen's render is taking longer than expected (repeater polls 30 × 30s = 15 min max). This can happen with complex avatars or high server load. Alternatively, M14's status check URL or response parsing is wrong, causing the "completed" branch to never trigger.

**Fix:** If the scenario finishes without updating the row, check Make's execution log for M14's output — does `data.data.status` actually equal `"completed"`? If HeyGen returns a different status string, the router filter won't match. Use the Render Checker scenario to pick up the row after the inline loop times out — that's exactly what it's designed for.

---

## 9. Status stuck at "Rendering" after HeyGen completes

**Symptom:** HeyGen render shows `status: completed` when you check the API directly, but the row in the sheet never moves from `Rendering` to `Done`.

**Diagnosis (V1 known bug):** Module 16 (Status → Done) uses wrong column names: `status`, `video_url`, `processed_at` instead of the correct V1 column names `Status`, `Raw Video Link`, `Last Updated`. With `useColumnHeaders: true`, the wrong names are silently ignored and no columns get updated.

**Fix:** In Make, edit M16's mapper. Change the values keys:
- `"status"` → `"Status"`
- `"video_url"` → `"Raw Video Link"`
- `"processed_at"` → `"Last Updated"`

Also add `"sheetName": "Queue"` to M16's mapper (it's missing — M11 has it, M16/17 don't).

Apply the same fix to M17: `"error"` → `"Error Message"`, `"status"` → `"Status"`.

**Workaround until fixed:** The Render Checker scenario (once created) will pick up Rendering rows and update them correctly — it uses the right column names from the start.

---

## 10. Sheet refs failing: rowNumber missing

**Symptom:** An `updateRow` module fails with an error about missing row number or invalid range.

**Diagnosis:** The `rowNumber` field in the mapper is referencing a module output that isn't set, or the trigger module (M1) output `__ROW_NUMBER__` isn't being accessed correctly.

**Fix:** Ensure `rowNumber` uses: `{{1.\`__ROW_NUMBER__\`}}` (backtick-escaped). Also make sure `spreadsheetId` does NOT have a leading slash (use `1reHZp...`, not `/1reHZp...`). Module 16 and 17 have a leading slash bug — remove it.

---

## 11. Wrong column updated (or column not found)

**Symptom:** An `updateRow` module runs without error, but the wrong column gets updated, or the target column stays blank.

**Diagnosis:** The `useColumnHeaders: true` setting requires exact column name matching (case-sensitive). The V1 schema uses Title Case (`Status`, `Raw Video Link`, `Render Job ID`). If your mapper uses lowercase (`status`, `video_url`) or different names, the update silently fails.

**Fix:** Always match column names exactly as they appear in the sheet header row. For V1 sheet, the correct names are:
- `Status` (not `status`)
- `Raw Video Link` (not `video_url`)
- `Last Updated` (not `processed_at` or `last_updated`)
- `Error Message` (not `error` or `errorMessage`)
- `Render Job ID` (not `render_job_id` or `video_id`)
- `Voice File URL` (not `voice_url` or `audio_url`)

---

## 12. Script Doc or Brief Doc link is malformed (`/d//edit`)

**Symptom:** The Script Doc Link or Brief Doc Link column shows a URL like `https://docs.google.com/document/d//edit` — the document ID between `/d/` and `/edit` is empty.

**Diagnosis:** The Google Docs `createADocumentFromTemplate` module (M24 or M25) succeeded in creating the doc, but the wrong output field was referenced when writing the URL back to the sheet. The module outputs `documentId` and `documentUrl` — if the mapper references the wrong field or a field that didn't populate, the URL is empty.

**Fix:** In M6's mapper for Script Doc Link: reference `M24.documentId` (or construct the URL as `https://docs.google.com/document/d/{{24.documentId}}/edit`). Confirm the field name in M24's output matches what M6 references. Test by running M24 alone and inspecting its output in Make's execution log.

---

## 13. Make API returns 403 for all write operations

**Symptom:** Attempting to create, clone, or update Make scenarios via the API returns HTTP 403 with `error code: 1010`.

**Diagnosis:** The `make-api-key` in Azure Key Vault `kvdaxdakonapilot` is read-scoped. It can read scenario details and blueprints (GET), partially update metadata like name and scheduling (PATCH), but cannot create new scenarios (POST) or modify blueprints (PUT).

**Fix:** For scenario creation or blueprint updates, use the Make UI directly (us2.make.com). Log in as `richard@1altx.com`. For activating/deactivating scenarios programmatically, use the `make_scenario_toggle` MCP tool.
