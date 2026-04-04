import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(__dirname, "kv-seed.json"), "utf-8"));
const KEY = seed["n8n-api-key"];
const BASE = "https://n8n.dakona.net/api/v1/workflows";
const WF_ID = "8EtgidLhvjicKoSO";
const ALLOW = ["name","nodes","connections","settings","staticData","pinData"];

const r = await fetch(`${BASE}/${WF_ID}`, {headers:{"X-N8N-API-KEY":KEY}});
const wf = await r.json();

const node = wf.nodes.find(n => n.name === "Read Sheet Data");
if (node) {
  let code = node.parameters.jsCode;
  
  // Show the fetch line
  const lines = code.split("\n");
  lines.forEach((l, i) => {
    if (l.includes("fetch(")) console.log("Line " + i + ":", l.trim());
  });
  
  // Replace any remaining fetch() with httpReq
  // First check if it's a different pattern
  code = code.replace(
    /const (\w+) = await fetch\(([^)]+)\)/g,
    "const $1 = await httpReq('GET', $2, {})"
  );
  
  // Also catch: await fetch(url, opts) patterns with multiline
  code = code.replace(
    /await fetch\(([^,]+),\s*\n?\s*(\{[\s\S]*?\})\s*\)/g,
    (match, url, opts) => {
      return "await httpReq('GET', " + url + ", " + opts + ")";
    }
  );
  
  // If still has fetch, do a brute force replacement
  if (code.includes("fetch(")) {
    code = code.replace(/fetch\(/g, "httpReq('GET', ");
    console.log("Brute force replaced remaining fetch calls");
  }
  
  node.parameters.jsCode = code;
  console.log("\nUpdated code:");
  console.log(code.slice(0, 500));
}

const body = {};
for (const k of ALLOW) if (wf[k] !== undefined) body[k] = wf[k];
const p = await fetch(`${BASE}/${WF_ID}`, {
  method: "PUT",
  headers: {"X-N8N-API-KEY":KEY,"Content-Type":"application/json"},
  body: JSON.stringify(body)
});
console.log("\nPUT:", p.ok ? "OK" : p.status);
