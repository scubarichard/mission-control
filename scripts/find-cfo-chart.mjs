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

// Find the CFO chart section — look for cfo, chart, canvas, Chart.js data
const searches = [
  "cfo-chart", "cfoChart", "cfo_chart", "CFO", "cfo-bar", 
  "laborChart", "labor-chart", "budgetChart",
  "new Chart", "Chart(", "datasets", "backgroundColor"
];

for (const s of searches) {
  let idx = html.indexOf(s);
  let count = 0;
  while (idx !== -1 && count < 3) {
    const start = Math.max(0, idx - 30);
    const end = Math.min(html.length, idx + 200);
    console.log("\n" + s + " @" + idx + ":");
    console.log(html.slice(start, end));
    idx = html.indexOf(s, idx + s.length);
    count++;
  }
}
