import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(__dirname, "kv-seed.json"), "utf-8"));
const KEY = seed["n8n-api-key"];
const BASE = "https://n8n.dakona.net/api/v1/workflows";
const WF_ID = "8EtgidLhvjicKoSO";
const ALLOW = ["name","nodes","connections","settings","staticData","pinData"];
const SHEET_ID = "1SpW7VSB27_yIf7mAYfSut_VOTyBmN0NU2jIpigesZps";
const SHEETS_CRED_ID = "fhAvmmHWXh2VIsWu";

const r = await fetch(`${BASE}/${WF_ID}`, {headers:{"X-N8N-API-KEY":KEY}});
const wf = await r.json();

// Replace the Code node with an HTTP Request node that uses Google Sheets OAuth + a Code node to format
// Strategy: Webhook -> HTTP Request (Sheets API) -> Code (format) -> Respond

// Remove old Read Sheet Data node
wf.nodes = wf.nodes.filter(n => n.name !== "Read Sheet Data");

// Add HTTP Request node to fetch from Sheets API
wf.nodes.push({
  parameters: {
    method: "GET",
    url: "https://sheets.googleapis.com/v4/spreadsheets/" + SHEET_ID + "/values/Raw_Jobs",
    authentication: "predefinedCredentialType",
    nodeCredentialType: "googleSheetsOAuth2Api",
    options: {}
  },
  name: "Fetch Sheet",
  type: "n8n-nodes-base.httpRequest",
  typeVersion: 4.2,
  position: [500, 300],
  credentials: { googleSheetsOAuth2Api: { id: SHEETS_CRED_ID, name: "Google Sheets account" } }
});

// Add Code node to format the response
wf.nodes.push({
  parameters: {
    jsCode: `const data = $input.first().json;
const values = data.values || [];

if (values.length <= 1) {
  // Only headers or empty
  return [{ json: { jobs: [], updated: new Date().toISOString(), source: 'google_sheets', count: 0 } }];
}

const headers = values[0];
const jobs = [];
for (let i = 1; i < values.length; i++) {
  const row = values[i];
  if (!row || row.length === 0) continue;
  const obj = {};
  headers.forEach((h, idx) => {
    obj[h] = row[idx] || '';
  });
  // Skip empty rows
  if (obj.opportunity_id || obj.job_name) jobs.push(obj);
}

return [{ json: { jobs, updated: new Date().toISOString(), source: 'google_sheets', count: jobs.length } }];`
  },
  name: "Format Response",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [750, 300]
});

// Update connections
wf.connections["Webhook"] = { main: [[{ node: "Fetch Sheet", type: "main", index: 0 }]] };
wf.connections["Fetch Sheet"] = { main: [[{ node: "Format Response", type: "main", index: 0 }]] };
wf.connections["Format Response"] = { main: [[{ node: "Respond", type: "main", index: 0 }]] };
delete wf.connections["Read Sheet Data"];

const body = {};
for (const k of ALLOW) if (wf[k] !== undefined) body[k] = wf[k];
const p = await fetch(`${BASE}/${WF_ID}`, {
  method: "PUT",
  headers: {"X-N8N-API-KEY":KEY,"Content-Type":"application/json"},
  body: JSON.stringify(body)
});
console.log("PUT:", p.ok ? "OK" : p.status);
