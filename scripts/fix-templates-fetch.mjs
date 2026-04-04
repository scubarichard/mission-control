// Fix fetch() in all GitHub workflow templates so future deploys don't have this issue
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import https from "https";
import urlMod from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(__dirname, "kv-seed.json"), "utf-8"));
const GH_TOKEN = seed["github-token"];
const OWNER = "scubarichard";
const REPO = "rpe-workflow-templates";

function httpReq(method, rawUrl, headers, postBody) {
  return new Promise((resolve, reject) => {
    const parsed = urlMod.parse(rawUrl);
    const data = postBody ? JSON.stringify(postBody) : null;
    const opts = {hostname:parsed.hostname,path:parsed.path,method,headers:Object.assign({},headers,data?{"Content-Length":Buffer.byteLength(data)}:{})};
    const req = https.request(opts, res => {
      let b=""; res.on("data",c=>b+=c);
      res.on("end",()=>{let j=null;try{j=JSON.parse(b)}catch{}resolve({ok:res.statusCode>=200&&res.statusCode<300,status:res.statusCode,json:j});});
    });
    req.on("error",reject);
    if(data) req.write(data);
    req.end();
  });
}

const GH_HEADERS = {
  "Authorization": "token " + GH_TOKEN,
  "Accept": "application/vnd.github+json",
  "User-Agent": "n8n-rpe",
  "Content-Type": "application/json"
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// The helper to inject — as it would appear inside a JSON string (escaped)
const HELPER_ESCAPED = "const https = require('https');\\nconst urlMod = require('url');\\nfunction httpReq(method, rawUrl, headers, postBody) {\\n  return new Promise((resolve, reject) => {\\n    const parsed = urlMod.parse(rawUrl);\\n    const opts = { hostname: parsed.hostname, path: parsed.path, method: method, headers: headers || {} };\\n    const req = https.request(opts, (res) => {\\n      let body = '';\\n      res.on('data', c => body += c);\\n      res.on('end', () => {\\n        let json = null;\\n        try { json = JSON.parse(body); } catch(e) {}\\n        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: json, text: body });\\n      });\\n    });\\n    req.on('error', reject);\\n    if (postBody) req.write(typeof postBody === 'string' ? postBody : JSON.stringify(postBody));\\n    req.end();\\n  });\\n}\\n";

// List templates
const lr = await httpReq("GET", `https://api.github.com/repos/${OWNER}/${REPO}/contents/`, GH_HEADERS);
const templates = lr.json.filter(f => f.name.endsWith(".json"));
console.log("Templates found:", templates.length);

let fixed = 0;
for (const file of templates) {
  const fr = await httpReq("GET", file.url, GH_HEADERS);
  const content = Buffer.from(fr.json.content, "base64").toString("utf-8");

  if (!content.includes("fetch(")) {
    console.log("SKIP:", file.name, "(no fetch)");
    continue;
  }

  // Parse as JSON, fix each Code node's jsCode
  let wf;
  try {
    wf = JSON.parse(content);
  } catch {
    console.log("SKIP:", file.name, "(not valid JSON)");
    continue;
  }

  let changed = false;
  for (const node of (wf.nodes || [])) {
    if (node.parameters?.jsCode && node.parameters.jsCode.includes("fetch(")) {
      let code = node.parameters.jsCode;

      // Skip if already patched
      if (code.includes("require('https')")) continue;

      // Replace fetch patterns
      code = code.replace(
        /await fetch\(([^,]+),\s*\{\s*headers:\s*([^}]+)\}\s*\)/g,
        "await httpReq('GET', $1, $2)"
      );
      code = code.replace(
        /await fetch\(([^,]+),\s*\{\s*method:\s*'POST',\s*headers:\s*([^,]+),\s*body:\s*([^}]+)\}\s*\)/g,
        "await httpReq('POST', $1, $2, $3)"
      );

      // Replace .json() / .text()
      code = code.replace(/(\w+)\.json\(\)/g, "$1.json");
      code = code.replace(/await (\w+)\.text\(\)/g, "$1.text");

      // Prepend helper
      code = "const https = require('https');\nconst urlMod = require('url');\nfunction httpReq(method, rawUrl, headers, postBody) {\n  return new Promise((resolve, reject) => {\n    const parsed = urlMod.parse(rawUrl);\n    const opts = { hostname: parsed.hostname, path: parsed.path, method: method, headers: headers || {} };\n    const req = https.request(opts, (res) => {\n      let body = '';\n      res.on('data', c => body += c);\n      res.on('end', () => {\n        let json = null;\n        try { json = JSON.parse(body); } catch(e) {}\n        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: json, text: body });\n      });\n    });\n    req.on('error', reject);\n    if (postBody) req.write(typeof postBody === 'string' ? postBody : JSON.stringify(postBody));\n    req.end();\n  });\n}\n\n" + code;

      node.parameters.jsCode = code;
      changed = true;
    }
  }

  if (changed) {
    const newContent = JSON.stringify(wf, null, 2);
    const commitR = await httpReq("PUT", `https://api.github.com/repos/${OWNER}/${REPO}/contents/${file.name}`, GH_HEADERS, {
      message: "fix: replace fetch() with native https in " + file.name,
      content: Buffer.from(newContent).toString("base64"),
      sha: fr.json.sha
    });
    console.log(commitR.ok ? "FIXED:" : "FAIL:", file.name);
    if (commitR.ok) fixed++;
  } else {
    console.log("NO CHANGE:", file.name);
  }
  await sleep(500);
}

console.log("\nDone. Fixed:", fixed, "/", templates.length, "templates");
