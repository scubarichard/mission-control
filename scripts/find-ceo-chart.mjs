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

// Find the CEO scatter chart
const scatterStart = html.indexOf("ceo-margin-chart");
if (scatterStart !== -1) {
  // Get a chunk around it
  const jsStart = html.lastIndexOf("new Chart", scatterStart);
  if (jsStart !== -1) {
    // Find closing of this Chart call
    let braces = 0;
    let end = jsStart;
    let started = false;
    for (let i = jsStart; i < html.length && i < jsStart + 2000; i++) {
      if (html[i] === "(") { braces++; started = true; }
      if (html[i] === ")") { braces--; }
      if (started && braces === 0) { end = i + 2; break; }
    }
    console.log("=== CEO Margin Chart ===");
    console.log(html.slice(jsStart, end));
  }
}

// Also find any gauge-fill style with hardcoded width
const gaugeMatches = html.match(/gauge-fill[^"]*"[^>]*style="[^"]*width:[^"]*"/g) || [];
console.log("\n=== Gauge fills ===");
gaugeMatches.forEach(g => console.log(g));

// Find hardcoded gauge percentages
const widthMatches = html.match(/width:\s*[\d.]+%/g) || [];
console.log("\n=== Hardcoded widths ===");
widthMatches.forEach(w => {
  const pct = parseFloat(w.match(/[\d.]+/)[0]);
  if (pct > 0 && pct !== 100) console.log(w);
});
