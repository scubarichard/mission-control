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

// Replace all stale dollar values
const replacements = [
  ["$154,500", "$0"],
  ["$25,475", "$0"],
  ["$122,900", "$0"],
  ["$57,258", "$0"],
  ["$37,855", "$0"],
  ["$19,403", "$0"],
  ["$76,425", "$0"],
  ["$127,375", "$0"],
];

for (const [old, nw] of replacements) {
  const count = html.split(old).length - 1;
  html = html.split(old).join(nw);
  if (count > 0) console.log("Replaced", old, "->", nw, "(" + count + "x)");
}

// Also fix any remaining non-zero percentages in card values (but not in CSS/config)
// Fix "Committed" "Paid out" "Under budget" sub labels — these should show context for $0
html = html.replace(/>Committed</, ">—<");
html = html.replace(/>Paid out</, ">—<");
html = html.replace(/>Under budget</, ">—<");
console.log("Replaced sub-labels");

console.log("\nVerify no stale values remain:");
for (const [old] of replacements) {
  if (html.includes(old)) console.log("  STILL HAS:", old);
}
console.log("  Check complete");

// Commit
const cr = await httpReq("PUT", "https://api.github.com/repos/scubarichard/aj-flooring-dashboard/contents/index.html", GH_HEADERS, {
  message: "fix: zero out all hardcoded stale values in dashboard template",
  content: Buffer.from(html).toString("base64"),
  sha: fr.json.sha
});
console.log("\nCommit:", cr.ok ? "OK" : cr.status);
