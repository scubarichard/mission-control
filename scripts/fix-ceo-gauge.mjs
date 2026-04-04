import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import https from "https";
import urlMod from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(__dirname, "kv-seed.json"), "utf-8"));
const GH_TOKEN = seed["github-token"];
const GH_HEADERS = {
  "Authorization": "token " + GH_TOKEN,
  "Accept": "application/vnd.github+json",
  "User-Agent": "n8n-rpe",
  "Content-Type": "application/json"
};

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

const fr = await httpReq("GET", "https://api.github.com/repos/scubarichard/aj-flooring-dashboard/contents/index.html", GH_HEADERS);
let html = Buffer.from(fr.json.content, "base64").toString("utf-8");

// Fix the hardcoded 67% gauge fill
const old = 'gauge-fill" style="width:67%;background:var(--green)"';
const fix = 'gauge-fill" style="width:0%;background:var(--green)"';

if (html.includes(old)) {
  html = html.replace(old, fix);
  console.log("Fixed gauge: 67% -> 0%");
} else {
  console.log("67% gauge not found");
}

// Do a final sweep — find any remaining non-zero hardcoded values
// Check for any remaining stale numbers
const stalePatterns = [
  /width:\s*(?!0%|100%)\d+%/g,
  /\$[\d,]{3,}/g,
];

for (const p of stalePatterns) {
  const matches = html.match(p) || [];
  const filtered = matches.filter(m => !m.includes("$0") && !m.includes("$40") && !m.includes("$80"));
  if (filtered.length > 0) {
    console.log("Remaining:", filtered);
  }
}

const cr = await httpReq("PUT", "https://api.github.com/repos/scubarichard/aj-flooring-dashboard/contents/index.html", GH_HEADERS, {
  message: "fix: zero out hardcoded 67% gauge fill in CEO view",
  content: Buffer.from(html).toString("base64"),
  sha: fr.json.sha
});
console.log("Commit:", cr.ok ? "OK" : cr.status);
