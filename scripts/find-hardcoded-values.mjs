import https from "https";
import urlMod from "url";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

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

// Find all card-value divs with content
const regex = /class="card-value[^"]*"[^>]*>([^<]+)<\/div>/g;
let match;
const values = [];
while ((match = regex.exec(html)) !== null) {
  const val = match[1].trim();
  // Look back for the label
  const before = html.slice(Math.max(0, match.index - 300), match.index);
  const labelMatch = before.match(/card-label[^>]*>([^<]+)<\/div>[^]*$/);
  const label = labelMatch ? labelMatch[1].trim() : "?";
  values.push({ label, value: val, index: match.index });
}

console.log("All hardcoded card values:");
values.forEach(v => {
  const isStale = v.value.includes("$") && !v.value.includes("$0") || 
                  (v.value.match(/^\d+$/) && parseInt(v.value) > 0) ||
                  (v.value.includes("%") && !v.value.includes("0.0%") && !v.value.includes("0%"));
  console.log((isStale ? ">>> STALE: " : "    OK:    ") + v.label + " = " + v.value);
});
