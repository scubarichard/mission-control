// Fix fetch in all 12 [AJ] workflows — replace fetch() with native https
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(__dirname, "kv-seed.json"), "utf-8"));
const state = JSON.parse(readFileSync(join(__dirname, "deploy-state.json"), "utf-8"));
const KEY = seed["n8n-api-key"];
const BASE = "https://n8n.dakona.net/api/v1/workflows";
const ALLOW = ["name","nodes","connections","settings","staticData","pinData"];

const HTTP_HELPER = `const https = require('https');
const urlMod = require('url');
function httpReq(method, rawUrl, headers, postBody) {
  return new Promise((resolve, reject) => {
    const parsed = urlMod.parse(rawUrl);
    const opts = { hostname: parsed.hostname, path: parsed.path, method: method, headers: headers || {} };
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch(e) {}
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: json, text: body });
      });
    });
    req.on('error', reject);
    if (postBody) req.write(typeof postBody === 'string' ? postBody : JSON.stringify(postBody));
    req.end();
  });
}
`;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const workflows = state.created_workflows || [];

console.log("=== Fixing fetch in", workflows.length, "[AJ] workflows ===\n");

let fixed = 0, skipped = 0, failed = 0;

for (const wf of workflows) {
  try {
    const r = await fetch(`${BASE}/${wf.id}`, {headers:{"X-N8N-API-KEY":KEY}});
    const data = await r.json();
    let changed = false;

    for (const node of data.nodes) {
      if (node.parameters?.jsCode && node.parameters.jsCode.includes("fetch(")) {
        let code = node.parameters.jsCode;
        
        // Skip if already has our helper
        if (code.includes("const https = require('https')")) continue;
        
        // Replace fetch patterns with httpReq
        // GET: await fetch(url, { headers: ... })
        code = code.replace(
          /await fetch\(([^,]+),\s*\{\s*headers:\s*([^}]+)\}\s*\)/g,
          "await httpReq('GET', $1, $2)"
        );
        
        // POST: await fetch(url, { method: 'POST', headers: ..., body: ... })
        code = code.replace(
          /await fetch\(([^,]+),\s*\{\s*method:\s*'POST',\s*headers:\s*([^,]+),\s*body:\s*([^}]+)\}\s*\)/g,
          "await httpReq('POST', $1, $2, $3)"
        );
        
        // Any remaining fetch( calls - generic replacement
        code = code.replace(
          /await fetch\(([^,]+),\s*\{([^}]*)\}\s*\)/g,
          (match, url, opts) => {
            if (opts.includes("method: 'POST'") || opts.includes('method: "POST"')) {
              return match; // already handled above
            }
            return "await httpReq('GET', " + url + ", {" + opts + "})";
          }
        );
        
        // Replace .json() calls on responses
        code = code.replace(/(\w+)\.json\(\)/g, '$1.json');
        code = code.replace(/await (\w+)\.text\(\)/g, '$1.text');
        
        // Inject helper at top
        code = HTTP_HELPER + "\n" + code;
        
        node.parameters.jsCode = code;
        changed = true;
      }
    }

    if (changed) {
      const body = {};
      for (const k of ALLOW) if (data[k] !== undefined) body[k] = data[k];
      const p = await fetch(`${BASE}/${wf.id}`, {
        method: "PUT",
        headers: {"X-N8N-API-KEY":KEY,"Content-Type":"application/json"},
        body: JSON.stringify(body)
      });
      console.log(p.ok ? "FIXED:" : "FAIL:", wf.name);
      if (p.ok) fixed++; else failed++;
    } else {
      console.log("SKIP:", wf.name, "(no fetch or already fixed)");
      skipped++;
    }
  } catch (e) {
    console.log("ERR:", wf.name, e.message);
    failed++;
  }
  await sleep(500);
}

console.log("\n=== Done ===");
console.log("Fixed:", fixed, "| Skipped:", skipped, "| Failed:", failed);
