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

const validate = wf.nodes.find(n => n.name === "Validate & Normalize");
if (validate) {
  validate.parameters.jsCode = validate.parameters.jsCode.replace(
    "const deployment_id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);",
    "const { randomUUID } = require('crypto'); const deployment_id = randomUUID();"
  );
  console.log("Fixed crypto import");
}

const body = {};
for (const k of ALLOW) if (wf[k] !== undefined) body[k] = wf[k];
const p = await fetch(`${BASE}/${WF_ID}`, {
  method: "PUT",
  headers: {"X-N8N-API-KEY":KEY,"Content-Type":"application/json"},
  body: JSON.stringify(body)
});
console.log("PUT:", p.ok ? "OK" : p.status);
