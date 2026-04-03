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
const codeNode = wf.nodes.find(n => n.name === "Build GHL Snapshot");

let code = codeNode.parameters.jsCode;

code = code.replace(
  /const GHL_TOKEN = '[^']*'/,
  "const GHL_TOKEN = 'pit-ff564790-ae77-4fcc-92c0-5ef4fb2ee66a'"
);
code = code.replace(
  /const LOCATION_ID = '[^']*'/,
  "const LOCATION_ID = 'OkpQxkeSnF4wqI31WmUg'"
);

codeNode.parameters.jsCode = code;

const body = {};
for (const k of ALLOW) if (wf[k] !== undefined) body[k] = wf[k];
const p = await fetch(`${BASE}/${WF_ID}`, {
  method: "PUT",
  headers: {"X-N8N-API-KEY":KEY,"Content-Type":"application/json"},
  body: JSON.stringify(body)
});
console.log("PUT:", p.ok ? "OK" : p.status);
