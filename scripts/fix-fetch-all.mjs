import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(__dirname, "kv-seed.json"), "utf-8"));
const KEY = seed["n8n-api-key"];
const BASE = "https://n8n.dakona.net/api/v1/workflows";
const ALLOW = ["name","nodes","connections","settings","staticData","pinData"];

// Standard HTTP helper to inject into Code nodes
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

function httpGet(url, headers) { return httpReq('GET', url, headers); }
function httpPost(url, headers, body) { return httpReq('POST', url, Object.assign({'Content-Type':'application/json'}, headers), body); }
`;

async function getWorkflow(id) {
  const r = await fetch(`${BASE}/${id}`, {headers:{"X-N8N-API-KEY":KEY}});
  return r.json();
}

async function putWorkflow(id, wf) {
  const body = {};
  for (const k of ALLOW) if (wf[k] !== undefined) body[k] = wf[k];
  const r = await fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: {"X-N8N-API-KEY":KEY,"Content-Type":"application/json"},
    body: JSON.stringify(body)
  });
  return r.ok;
}

function patchFetch(code) {
  // Replace fetch() calls with httpGet/httpPost, and inject helper at top
  // Pattern: await fetch(url, { headers: ... }) for GET
  // Pattern: await fetch(url, { method: 'POST', headers: ..., body: ... }) for POST
  
  let patched = code;
  
  // Replace GET fetch patterns
  patched = patched.replace(
    /const (\w+) = await fetch\(([^,]+),\s*\{\s*headers:\s*(\{[^}]+\})\s*\}\);/g,
    'const $1 = await httpGet($2, $3);'
  );
  patched = patched.replace(
    /const (\w+) = await fetch\(([^,]+),\s*\{\s*headers:\s*(\w+)\s*\}\);/g,
    'const $1 = await httpGet($2, $3);'
  );
  
  // Replace POST fetch patterns
  patched = patched.replace(
    /const (\w+) = await fetch\(([^,]+),\s*\{\s*method:\s*'POST',\s*headers:\s*(\{[^}]+\}),\s*body:\s*([^}]+)\}\);/g,
    'const $1 = await httpPost($2, $3, $4);'
  );
  
  // For response handling: .json() is already in our helper
  // Replace: const data = await resp.json() -> const data = resp.json
  patched = patched.replace(/await (\w+)\.json\(\)/g, '$1.json');
  patched = patched.replace(/await (\w+)\.text\(\)/g, '$1.text');
  
  // Replace resp.ok checks (already compatible)
  // Replace !resp.ok patterns
  
  // Inject helper at top if we made changes
  if (patched !== code) {
    patched = HTTP_HELPER + '\n' + patched;
  }
  
  return patched;
}

// ========================================
// Fix v14 GHL Snapshot
// ========================================
console.log("=== v14 GHL Snapshot ===");
const v14 = await getWorkflow("OUpro4bCRTQstFC6");
const v14code = v14.nodes.find(n => n.name === "Build GHL Snapshot");
if (v14code && v14code.parameters.jsCode.includes("fetch(")) {
  // This one is complex - rewrite the GHL API helper
  let code = v14code.parameters.jsCode;
  
  // Replace the ghlGet function
  code = code.replace(
    /async function ghlGet\(path\) \{[\s\S]*?return [\s\S]*?\n\}/,
    `async function ghlGet(path) {
  const r = await httpGet(BASE + path, HEADERS);
  return r.json || {};
}`
  );
  
  // Replace any direct fetch calls
  code = code.replace(/await fetch\(/g, '// replaced-fetch(');
  
  // Inject helper at top (after the comment block)
  const firstConst = code.indexOf('const GHL_TOKEN');
  code = code.slice(0, firstConst) + HTTP_HELPER + '\n' + code.slice(firstConst);
  
  v14code.parameters.jsCode = code;
  const ok = await putWorkflow("OUpro4bCRTQstFC6", v14);
  console.log("PUT:", ok ? "OK" : "FAIL");
} else {
  console.log("No fetch found or node missing");
}

// ========================================
// Fix v13 ClickUp Snapshot
// ========================================
console.log("\n=== v13 ClickUp Snapshot ===");
const v13 = await getWorkflow("3PAstzFCt1qlqCRs");
let v13HasFetch = false;
for (const node of v13.nodes) {
  if (node.parameters && node.parameters.jsCode && node.parameters.jsCode.includes("fetch(")) {
    v13HasFetch = true;
    console.log("Node with fetch:", node.name);
  }
}
if (v13HasFetch) {
  for (const node of v13.nodes) {
    if (node.parameters && node.parameters.jsCode && node.parameters.jsCode.includes("fetch(")) {
      let code = node.parameters.jsCode;
      code = patchFetch(code);
      node.parameters.jsCode = code;
    }
  }
  const ok = await putWorkflow("3PAstzFCt1qlqCRs", v13);
  console.log("PUT:", ok ? "OK" : "FAIL");
} else {
  console.log("No fetch calls found — OK");
}

// ========================================
// Check v01-v12 RPE workflows
// ========================================
console.log("\n=== Checking v01-v12 ===");
const rpeIds = {
  "c0SH3hq7pOSJOUT8": "v01",
  "4SdANPI4fHdQHfHt": "v02",
  "XLSzvHPH1EXE5Hmi": "v03",
  "htdexofw5jLuXdVC": "v04",
  "DglLCFDXMImJm4ab": "v05",
  "c2HXjNKTNzXJ03Gb": "v06",
  "mNx2Bzsyv6mHJcPV": "v07",
  "SWMRfS0TOop4Y2xi": "v09",
  "7f6zGmBndNabEibH": "v10",
  "5w24uaikuQ7xwZpx": "v11",
  "mcahdYCVbZ7778wl": "v12",
};

for (const [id, label] of Object.entries(rpeIds)) {
  const wf = await getWorkflow(id);
  let hasFetch = false;
  for (const node of wf.nodes) {
    if (node.parameters && node.parameters.jsCode && node.parameters.jsCode.includes("fetch(")) {
      hasFetch = true;
    }
  }
  console.log(label + ":", hasFetch ? "HAS FETCH — needs fix" : "OK");
}
