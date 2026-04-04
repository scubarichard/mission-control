import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import https from "https";
import urlMod from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(__dirname, "kv-seed.json"), "utf-8"));
const GH_TOKEN = seed["github-token"];

function httpGet(rawUrl, headers) {
  return new Promise((resolve, reject) => {
    const parsed = urlMod.parse(rawUrl);
    const opts = {hostname:parsed.hostname,path:parsed.path,method:"GET",headers:headers||{}};
    const req = https.request(opts, res => {
      let b=""; res.on("data",c=>b+=c);
      res.on("end",()=>resolve(b));
    });
    req.on("error",reject);req.end();
  });
}

const html = await httpGet("https://raw.githubusercontent.com/scubarichard/aj-flooring-dashboard/main/index.html", {
  "Authorization": "token " + GH_TOKEN, "User-Agent": "n8n-rpe"
});

// Find GM view section and all charts/hardcoded data in it
const gmStart = html.indexOf('id="view-gm"');
const gmEnd = html.indexOf('<!-- ═', gmStart + 100);
const gmSection = html.slice(gmStart, gmEnd > gmStart ? gmEnd : gmStart + 5000);

// Find all hardcoded values in GM section
const dollarRegex = /\$[\d,]+/g;
let match;
while ((match = dollarRegex.exec(gmSection)) !== null) {
  if (match[0] !== "$0") {
    const ctx = gmSection.slice(Math.max(0, match.index - 80), match.index + match[0].length + 20);
    console.log("STALE:", match[0], "| context:", ctx.slice(-100));
  }
}

// Find GM chart functions
const gmChartPatterns = ["gm-", "gmChart", "gm_chart", "product-chart", "gm-product"];
for (const p of gmChartPatterns) {
  let idx = html.indexOf(p);
  while (idx !== -1) {
    console.log("\n" + p + " @" + idx + ":");
    console.log(html.slice(Math.max(0, idx - 20), idx + 150));
    idx = html.indexOf(p, idx + p.length);
  }
}

// Find the GM chart.js initialization
const gmChartStart = html.indexOf('if(view==="gm")');
if (gmChartStart !== -1) {
  // Get a good chunk after it
  console.log("\n=== GM Chart Init ===");
  console.log(html.slice(gmChartStart, gmChartStart + 1500));
}
