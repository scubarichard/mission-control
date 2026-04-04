// Fix the source rpe-dashboard/index.html template — zero out all sample data
// so future client deploys start clean
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

console.log("Fetching source template...");
const fr = await httpReq("GET", "https://api.github.com/repos/scubarichard/rpe-dashboard/contents/index.html", GH_HEADERS);
let html = Buffer.from(fr.json.content, "base64").toString("utf-8");

// Replace CONFIG with placeholder tokens for the deploy script to hydrate
const configBlock = `var CONFIG = {
  API_URL: '{{API_URL}}',
  GHL_OPP_BASE: '{{GHL_OPP_BASE}}',
  MS_PER_DAY: 86400000,
  MARGIN_TARGET: {{MARGIN_TARGET}},
  MARGIN_WARNING: {{MARGIN_WARNING}},
  LABOR_CAP_PCT: {{LABOR_CAP_PCT}},
  LABOR_WARNING_PCT: {{LABOR_WARNING_PCT}},
  STALL_DAYS_RED: 6,
  STALL_DAYS_ORANGE: 3,
  RPE_TARGET: 40000,
  RPE_WARNING: 25000,
  RPE_GAUGE_MAX: 80000,
  HEADCOUNT: {{HEADCOUNT}},
  RED_FLAG_COUNT: 3,
  VELOCITY_DAYS: { today: 14, week: 28, ytd: 90 },
  CREW_NAMES: {{CREW_NAMES}}
};`;

html = html.replace(/var CONFIG = \{[\s\S]*?\};/, configBlock);

// Zero all hardcoded sample values
const replacements = [
  ["$154,500", "$0"], ["$25,475", "$0"], ["$122,900", "$0"],
  ["$57,258", "$0"], ["$37,855", "$0"], ["$19,403", "$0"],
  ["$76,425", "$0"], ["$127,375", "$0"],
];
for (const [old, nw] of replacements) {
  html = html.split(old).join(nw);
}

// Margin
html = html.replace(/>40\.1%</g, ">0.0%<");

// Completed MTD
html = html.replace(/(<div class="card-label">Completed MTD<\/div>\s*<div class="card-value[^"]*">)1(<\/div>)/, "$10$2");

// Gauge
html = html.replace(/gauge-fill" style="width:67%/g, 'gauge-fill" style="width:0%');

// CFO chart
html = html.replace(/data:\[57258,37855,19403\]/, "data:[0,0,0]");

// GM product chart
html = html.replace(/data:\[44,43,35,38\]/, "data:[0,0,0,0]");

// Change orders
html = html.replace(/var CHANGE_ORDERS = \[[\s\S]*?\];/, "var CHANGE_ORDERS = [];");

// Sub-labels
html = html.replace(/>Committed<\/div>/g, ">—</div>");
html = html.replace(/>Paid out<\/div>/g, ">—</div>");
html = html.replace(/>Under budget<\/div>/g, ">—</div>");

// Verify
const scriptStart = html.lastIndexOf("<script>");
const scriptEnd = html.lastIndexOf("</script>");
const js = html.slice(scriptStart + 8, scriptEnd);
let brackets = 0, parens = 0;
for (let i = 0; i < js.length; i++) {
  if (js[i] === "{") brackets++;
  if (js[i] === "}") brackets--;
  if (js[i] === "(") parens++;
  if (js[i] === ")") parens--;
}
console.log("JS syntax — brackets:", brackets, "parens:", parens, brackets === 0 && parens === 0 ? "OK" : "ERROR");

const cr = await httpReq("PUT", "https://api.github.com/repos/scubarichard/rpe-dashboard/contents/index.html", GH_HEADERS, {
  message: "fix: zero all hardcoded sample data in template, add CONFIG placeholders for deploy script",
  content: Buffer.from(html).toString("base64"),
  sha: fr.json.sha
});
console.log("Commit:", cr.ok ? "OK" : cr.status);
