import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(__dirname, "kv-seed.json"), "utf-8"));
const KEY = seed["n8n-api-key"];
const BASE = "https://n8n.dakona.net/api/v1/workflows";
const WF_ID = "OUpro4bCRTQstFC6";
const ALLOW = ["name","nodes","connections","settings","staticData","pinData"];

const r = await fetch(`${BASE}/${WF_ID}`, {headers:{"X-N8N-API-KEY":KEY}});
const wf = await r.json();
const code = wf.nodes.find(n => n.name === "Build GHL Snapshot");

// Show current values
const tokenMatch = code.parameters.jsCode.match(/const GHL_TOKEN = '([^']*)'/);
const locMatch = code.parameters.jsCode.match(/const LOCATION_ID = '([^']*)'/);
console.log("Current token:", tokenMatch[1].slice(0,20) + "...");
console.log("Current location:", locMatch[1]);

// Update token
code.parameters.jsCode = code.parameters.jsCode.replace(
  tokenMatch[0],
  "const GHL_TOKEN = '" + seed["rpe-pit-token"] + "'"
);
console.log("Updated to rotated agency PIT token");

const body = {};
for (const k of ALLOW) if (wf[k] !== undefined) body[k] = wf[k];
const p = await fetch(`${BASE}/${WF_ID}`, {
  method: "PUT",
  headers: {"X-N8N-API-KEY":KEY,"Content-Type":"application/json"},
  body: JSON.stringify(body)
});
console.log("PUT:", p.ok ? "OK" : p.status);
