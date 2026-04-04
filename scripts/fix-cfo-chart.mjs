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

// Replace the hardcoded chart data with dynamic calculation from JOBS
const oldChart = 'data:{labels:["Labor Budget","Labor Cost","Variance"],datasets:[{data:[57258,37855,19403],backgroundColor:[gold,orange,green],borderRadius:6}]}';
const newChart = 'data:{labels:["Labor Budget","Labor Cost","Variance"],datasets:[{data:[JOBS.reduce(function(s,j){return s+(parseFloat(j.labor_budget)||0);},0),JOBS.reduce(function(s,j){return s+(parseFloat(j.crew_payout)||0);},0),JOBS.reduce(function(s,j){return s+(parseFloat(j.labor_budget)||0);},0)-JOBS.reduce(function(s,j){return s+(parseFloat(j.crew_payout)||0);},0)],backgroundColor:[gold,orange,green],borderRadius:6}]}';

if (html.includes(oldChart)) {
  html = html.replace(oldChart, newChart);
  console.log("Replaced hardcoded chart data with dynamic JOBS calculation");
} else {
  console.log("Hardcoded chart data not found — may already be fixed");
  // Try to find it
  const idx = html.indexOf("57258");
  if (idx !== -1) {
    console.log("Found 57258 at index", idx);
    console.log("Context:", html.slice(Math.max(0,idx-50), idx+100));
  }
}

// Also update the CFO labor card values to be dynamic
// Replace the static $0 labels with IDs so JS can update them
html = html.replace(
  /<div class="card-label">Labor Budget<\/div>\s*<div class="card-value[^"]*"[^>]*>\$0<\/div>\s*<div class="card-sub">&#8212;<\/div>/,
  '<div class="card-label">Labor Budget</div>\n        <div class="card-value" id="cfo-labor-budget">$0</div>\n        <div class="card-sub" id="cfo-labor-budget-sub">No data</div>'
);
html = html.replace(
  /<div class="card-label">Labor Budget<\/div>\s*<div class="card-value[^"]*"[^>]*>\$0<\/div>\s*<div class="card-sub">&#8212;<\/div>/,
  '<div class="card-label">Labor Cost</div>\n        <div class="card-value" id="cfo-labor-cost">$0</div>\n        <div class="card-sub" id="cfo-labor-cost-sub">No data</div>'
);
html = html.replace(
  /<div class="card-label">Labor Cost<\/div>\s*<div class="card-value[^"]*"[^>]*>\$0<\/div>\s*<div class="card-sub">&#8212;<\/div>/,
  '<div class="card-label">Labor Cost</div>\n        <div class="card-value" id="cfo-labor-cost">$0</div>\n        <div class="card-sub" id="cfo-labor-cost-sub">No data</div>'
);

// Commit
const cr = await httpReq("PUT", "https://api.github.com/repos/scubarichard/aj-flooring-dashboard/contents/index.html", GH_HEADERS, {
  message: "fix: replace hardcoded CFO chart data with dynamic JOBS calculation",
  content: Buffer.from(html).toString("base64"),
  sha: fr.json.sha
});
console.log("Commit:", cr.ok ? "OK" : cr.status);
