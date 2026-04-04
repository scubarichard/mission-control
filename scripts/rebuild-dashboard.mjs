// Fresh rebuild: pull original template, inject AJ Flooring config, zero out sample data
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

// 1. Fetch ORIGINAL template from rpe-dashboard repo
console.log("Fetching original template...");
const srcR = await httpReq("GET", "https://api.github.com/repos/scubarichard/rpe-dashboard/contents/index.html", GH_HEADERS);
let html = Buffer.from(srcR.json.content, "base64").toString("utf-8");
console.log("Template fetched:", html.length, "chars");

// 2. Inject AJ Flooring CONFIG
const configBlock = `var CONFIG = {
  API_URL: 'https://n8n.dakona.net/webhook/aj-flooring-v11',
  GHL_OPP_BASE: 'https://app.gohighlevel.com/v2/location/eWmOhK85TA8xb2HTiSh6/opportunities/list/',
  MS_PER_DAY: 86400000,
  MARGIN_TARGET: 40,
  MARGIN_WARNING: 35,
  LABOR_CAP_PCT: 15,
  LABOR_WARNING_PCT: 12,
  STALL_DAYS_RED: 6,
  STALL_DAYS_ORANGE: 3,
  RPE_TARGET: 40000,
  RPE_WARNING: 25000,
  RPE_GAUGE_MAX: 80000,
  HEADCOUNT: 2,
  RED_FLAG_COUNT: 3,
  VELOCITY_DAYS: { today: 14, week: 28, ytd: 90 },
  CREW_NAMES: {"Crew A":"Lead 1"}
};`;

html = html.replace(/var CONFIG = \{[\s\S]*?\};/, configBlock);
console.log("CONFIG injected");

// 3. Zero out ALL hardcoded sample data values
// Dollar amounts in card-value divs
html = html.replace(/(\$)154,500/g, "$0");
html = html.replace(/(\$)25,475/g, "$0");
html = html.replace(/(\$)122,900/g, "$0");
html = html.replace(/(\$)57,258/g, "$0");
html = html.replace(/(\$)37,855/g, "$0");
html = html.replace(/(\$)19,403/g, "$0");
html = html.replace(/(\$)76,425/g, "$0");
html = html.replace(/(\$)127,375/g, "$0");

// Margin percentage
html = html.replace(/>40\.1%</g, ">0.0%<");

// Completed MTD
html = html.replace(/(<div class="card-label">Completed MTD<\/div>\s*<div class="card-value[^"]*">)1(<\/div>)/, "$10$2");

// Gauge fill
html = html.replace(/gauge-fill" style="width:67%/g, 'gauge-fill" style="width:0%');

// CFO chart — zero the hardcoded data
html = html.replace(/data:\[57258,37855,19403\]/, "data:[0,0,0]");

// GM product chart — zero the hardcoded data
html = html.replace(/data:\[44,43,35,38\]/, "data:[0,0,0,0]");

// Change orders — empty the hardcoded array
html = html.replace(/var CHANGE_ORDERS = \[[\s\S]*?\];/, "var CHANGE_ORDERS = [];");

// Sub-labels for CFO labor cards
html = html.replace(/>Committed<\/div>/g, ">—</div>");
html = html.replace(/>Paid out<\/div>/g, ">—</div>");
html = html.replace(/>Under budget<\/div>/g, ">—</div>");

console.log("Sample data zeroed");

// 4. Verify JS syntax
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

// 5. Commit to aj-flooring-dashboard
const existR = await httpReq("GET", "https://api.github.com/repos/scubarichard/aj-flooring-dashboard/contents/index.html", GH_HEADERS);
const cr = await httpReq("PUT", "https://api.github.com/repos/scubarichard/aj-flooring-dashboard/contents/index.html", GH_HEADERS, {
  message: "rebuild: fresh template with AJ Flooring config + zeroed sample data",
  content: Buffer.from(html).toString("base64"),
  sha: existR.json.sha
});
console.log("Commit:", cr.ok ? "OK" : cr.status);
