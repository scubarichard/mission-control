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

// Check around the initCFOChart area for syntax issues
const funcStart = html.indexOf("function initCFOChart()");
const chunk = html.slice(funcStart, funcStart + 800);
console.log("=== initCFOChart area ===");
console.log(chunk);

// Check if the fetch/JOBS loading area is intact
const fetchArea = html.indexOf("fetch(CONFIG.API_URL)");
if (fetchArea !== -1) {
  console.log("\n=== Fetch area ===");
  console.log(html.slice(fetchArea - 100, fetchArea + 300));
}

// Check for obvious syntax errors - unmatched brackets
const area = html.slice(funcStart, funcStart + 2000);
let brackets = 0;
let parens = 0;
for (let i = 0; i < area.length; i++) {
  if (area[i] === "{") brackets++;
  if (area[i] === "}") brackets--;
  if (area[i] === "(") parens++;
  if (area[i] === ")") parens--;
  if (brackets < 0 || parens < 0) {
    console.log("\n!!! Unmatched bracket/paren at offset", i);
    console.log("Context:", area.slice(Math.max(0,i-50), i+50));
    break;
  }
}
console.log("\nBracket balance:", brackets, "Paren balance:", parens);
