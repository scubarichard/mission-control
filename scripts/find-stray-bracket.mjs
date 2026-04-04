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

const scriptStart = html.lastIndexOf("<script>");
const scriptEnd = html.lastIndexOf("</script>");
const js = html.slice(scriptStart + 8, scriptEnd);

// Track bracket depth and find where it goes wrong
let depth = 0;
let lastZero = 0;
const lines = js.split("\n");
let lineNum = 0;
let charIdx = 0;

for (let i = 0; i < js.length; i++) {
  if (js[i] === "\n") lineNum++;
  if (js[i] === "{") depth++;
  if (js[i] === "}") {
    depth--;
    if (depth === 0) lastZero = i;
  }
}

console.log("Final depth:", depth);
console.log("Last time at depth 0: char", lastZero);

// Show context around where we last hit 0
const ctx = js.slice(lastZero - 20, lastZero + 200);
console.log("\nLast balanced point:");
console.log(ctx.slice(0, 300));

// Now scan from there to find the extra {
depth = 0;
for (let i = lastZero; i < js.length; i++) {
  if (js[i] === "{") {
    depth++;
    if (depth === 1) {
      console.log("\nFirst unmatched { after last balance point, at char", i);
      console.log("Context:", js.slice(Math.max(0, i-50), i+100));
    }
  }
  if (js[i] === "}") depth--;
}
