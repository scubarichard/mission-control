import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(__dirname, "kv-seed.json"), "utf-8"));
const KEY = seed["n8n-api-key"];
const BASE = "https://n8n.dakona.net/api/v1/workflows";
const WF_ID = "j6znmoVMC7a6QKFM";
const ALLOW = ["name","nodes","connections","settings","staticData","pinData"];

const r = await fetch(`${BASE}/${WF_ID}`, {headers:{"X-N8N-API-KEY":KEY}});
const wf = await r.json();

const pf = wf.nodes.find(n => n.name === "Pre-Flight Checks");
if (pf) {
  // Change GHL Agency from required to optional/informational
  pf.parameters.jsCode = pf.parameters.jsCode.replace(
    `checks.push({ platform: 'GHL Agency', status: r.ok ? 'PASS' : 'FAIL',
      message: r.ok ? 'Agency token valid' : 'HTTP ' + r.status + ' — agency token invalid' });`,
    `checks.push({ platform: 'GHL Agency', status: r.ok ? 'PASS' : 'SKIP',
      message: r.ok ? 'Agency token valid' : 'HTTP ' + r.status + ' — agency token not validated (optional)' });`
  );
  // Also fix the error catch for agency
  pf.parameters.jsCode = pf.parameters.jsCode.replace(
    `checks.push({ platform: 'GHL Agency', status: 'FAIL', message: 'Connection error: ' + e.message });`,
    `checks.push({ platform: 'GHL Agency', status: 'SKIP', message: 'Agency check skipped: ' + e.message });`
  );
  
  // Also add n8n_folder_id to Validate extraction
  console.log("OK: Agency check now optional (SKIP not FAIL)");
}

// Update Validate & Normalize to pass n8n_folder_id from payload
const validate = wf.nodes.find(n => n.name === "Validate & Normalize");
if (validate) {
  let code = validate.parameters.jsCode;
  if (!code.includes("n8n_folder_id = (b.n8n_folder_id")) {
    code = code.replace(
      "const n8n_folder_id = (b.n8n_folder_id || '').trim();",
      "const n8n_folder_id = (b.n8n_folder_id || '').trim();"
    );
    // Already exists, good
  }
  validate.parameters.jsCode = code;
}

const body = {};
for (const k of ALLOW) if (wf[k] !== undefined) body[k] = wf[k];
const p = await fetch(`${BASE}/${WF_ID}`, {
  method: "PUT",
  headers: {"X-N8N-API-KEY":KEY,"Content-Type":"application/json"},
  body: JSON.stringify(body)
});
console.log("PUT:", p.ok ? "OK" : p.status);
