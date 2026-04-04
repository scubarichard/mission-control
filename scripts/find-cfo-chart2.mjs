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

// Get initCFOChart function
const start = html.indexOf("function initCFOChart()");
if (start === -1) { console.log("Not found"); process.exit(); }

// Find the closing brace by counting braces
let braces = 0;
let end = start;
let inFunc = false;
for (let i = start; i < html.length; i++) {
  if (html[i] === "{") { braces++; inFunc = true; }
  if (html[i] === "}") { braces--; }
  if (inFunc && braces === 0) { end = i + 1; break; }
}

console.log(html.slice(start, end));
