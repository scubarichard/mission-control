const BASE = "https://n8n.dakona.net/api/v1/workflows";
const STRIP = ["id","createdAt","updatedAt","versionId","activeVersionId",
  "versionCounter","triggerCount","shared","tags","homeProject",
  "sharedWithProjects","activeVersion","isArchived"];

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(__dirname, "kv-seed.json"), "utf-8"));
const API_KEY = seed["n8n-api-key"];

const RENAMES = {
  "c0SH3hq7pOSJOUT8": "[RPE] v01 - Margin Guardrail",
  "4SdANPI4fHdQHfHt": "[RPE] v02 - Labor Cap Monitor",
  "XLSzvHPH1EXE5Hmi": "[RPE] v03 - Field Validation Gate",
  "htdexofw5jLuXdVC": "[RPE] v04 - Job Completion",
  "DglLCFDXMImJm4ab": "[RPE] v05 - Material Order",
  "c2HXjNKTNzXJ03Gb": "[RPE] v06 - Change Order Sync",
  "mNx2Bzsyv6mHJcPV": "[RPE] v07 - Payout Gate",
  "SWMRfS0TOop4Y2xi": "[RPE] v09 - Dashboard Feed",
  "7f6zGmBndNabEibH": "[RPE] v10 - Dashboard Feed GHL",
  "5w24uaikuQ7xwZpx": "[RPE] v11 - Dashboard Live JSON",
  "mcahdYCVbZ7778wl": "[RPE] v12 - Dashboard Webhook",
  "j6znmoVMC7a6QKFM": "[RPE] v20 - Client Onboarding Orchestrator",
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(method, wid, body) {
  const opts = {
    method,
    headers: { "X-N8N-API-KEY": API_KEY },
  };
  if (body) {
    opts.headers["Content-Type"] = "application/json; charset=utf-8";
    opts.body = JSON.stringify(body);
  }
  const resp = await fetch(`${BASE}/${wid}`, opts);
  if (!resp.ok) throw new Error(`${resp.status} ${await resp.text().then(t=>t.slice(0,200))}`);
  return resp.json();
}

for (const [wid, newName] of Object.entries(RENAMES)) {
  try {
    const wf = await api("GET", wid);
    wf.name = newName;
    for (const k of STRIP) delete wf[k];
    const r = await api("PUT", wid, wf);
    console.log(`OK: ${r.name}`);
  } catch (e) {
    console.log(`FAIL: ${newName} - ${e.message}`);
  }
  await sleep(1000);
}
