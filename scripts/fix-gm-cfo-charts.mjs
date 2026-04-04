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

let changes = 0;

// 1. Fix GM Product Chart — replace hardcoded data with dynamic from JOBS
const oldGmChart = 'data:[44,43,35,38]';
const newGmChart = 'data:(function(){var types=["LVP","Hardwood","Carpet","Tile"];return types.map(function(t){var matching=JOBS.filter(function(j){return j.product===t;});return matching.length===0?0:Math.round(matching.reduce(function(s,j){return s+j.margin;},0)/matching.length);});})()';
if (html.includes(oldGmChart)) {
  html = html.replace(oldGmChart, newGmChart);
  console.log("Fixed GM product chart: [44,43,35,38] -> dynamic");
  changes++;
}

// 2. Fix CFO Labor Chart if still hardcoded (check if previous fix took)
if (html.includes("data:[57258,37855,19403]")) {
  const oldCfoChart = "data:[57258,37855,19403]";
  const newCfoChart = "data:[JOBS.reduce(function(s,j){return s+(parseFloat(j.labor_budget)||0);},0),JOBS.reduce(function(s,j){return s+(parseFloat(j.crew_payout)||0);},0),JOBS.reduce(function(s,j){return s+(parseFloat(j.labor_budget)||0);},0)-JOBS.reduce(function(s,j){return s+(parseFloat(j.crew_payout)||0);},0)]";
  html = html.replace(oldCfoChart, newCfoChart);
  console.log("Fixed CFO labor chart: [57258,37855,19403] -> dynamic");
  changes++;
} else {
  console.log("CFO chart already fixed or different format");
}

// 3. Check for any ClickUp references
const clickupRefs = [];
let idx = html.indexOf("clickup");
while (idx !== -1) {
  clickupRefs.push(html.slice(Math.max(0, idx-30), idx+50));
  idx = html.indexOf("clickup", idx + 7);
}
idx = html.indexOf("ClickUp");
while (idx !== -1) {
  clickupRefs.push(html.slice(Math.max(0, idx-30), idx+50));
  idx = html.indexOf("ClickUp", idx + 7);
}
if (clickupRefs.length > 0) {
  console.log("\nClickUp references found:", clickupRefs.length);
  clickupRefs.forEach(r => console.log("  ", r.replace(/\n/g, " ").trim()));
}

// 4. Check for any remaining hardcoded dollar amounts > $0
const dollarMatches = html.match(/\$[\d,]{2,}/g) || [];
const nonZero = dollarMatches.filter(d => d !== "$0" && !d.startsWith("$0,"));
if (nonZero.length > 0) {
  console.log("\nRemaining non-zero dollar values:", nonZero);
}

// Commit
if (changes > 0) {
  const cr = await httpReq("PUT", "https://api.github.com/repos/scubarichard/aj-flooring-dashboard/contents/index.html", GH_HEADERS, {
    message: "fix: replace hardcoded GM product chart + CFO labor chart with dynamic JOBS data",
    content: Buffer.from(html).toString("base64"),
    sha: fr.json.sha
  });
  console.log("\nCommit:", cr.ok ? "OK" : cr.status);
} else {
  console.log("\nNo changes needed");
}
