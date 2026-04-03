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

// Fix the broken ghl function - replace the mangled version
code = code.replace(
  /async function ghl\(path\) \{[\s\S]*?return resp\.json[\s\S]*?\n\}/,
  `async function ghl(path) {
  const fullUrl = path.startsWith('http') ? path : BASE + path;
  const resp = await httpGet(fullUrl, HEADERS);
  if (!resp.ok) return { error: resp.status, url: fullUrl };
  return resp.json || {};
}`
);

// Also fix any remaining // replaced-fetch( calls
code = code.replace(/\/\/ replaced-fetch\(/g, 'await httpGet(');

codeNode.parameters.jsCode = code;

const body = {};
for (const k of ALLOW) if (wf[k] !== undefined) body[k] = wf[k];
const p = await fetch(`${BASE}/${WF_ID}`, {
  method: "PUT",
  headers: {"X-N8N-API-KEY":KEY,"Content-Type":"application/json"},
  body: JSON.stringify(body)
});
console.log("PUT:", p.ok ? "OK" : p.status);
