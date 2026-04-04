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

// Fix the broken datasets line
const broken = 'datasets:[{data:[0,0,0]},';
const fixed = 'datasets:[{data:[0,0,0],backgroundColor:[gold,orange,green],borderRadius:6}]},';

if (html.includes(broken)) {
  html = html.replace(broken, fixed);
  console.log("Fixed broken datasets line");
} else {
  console.log("Broken pattern not found, searching...");
  const idx = html.indexOf("datasets:[{data:[0,0,0]");
  if (idx !== -1) {
    console.log("Found at", idx, ":", html.slice(idx, idx + 100));
  }
}

// Verify syntax around initCFOChart
const funcStart = html.indexOf("function initCFOChart()");
const area = html.slice(funcStart, funcStart + 600);
let brackets = 0;
for (let i = 0; i < area.length; i++) {
  if (area[i] === "{") brackets++;
  if (area[i] === "}") brackets--;
}
console.log("Bracket balance in initCFOChart:", brackets === 0 ? "OK" : "UNBALANCED (" + brackets + ")");

const cr = await httpReq("PUT", "https://api.github.com/repos/scubarichard/aj-flooring-dashboard/contents/index.html", GH_HEADERS, {
  message: "fix: restore broken CFO chart datasets structure",
  content: Buffer.from(html).toString("base64"),
  sha: fr.json.sha
});
console.log("Commit:", cr.ok ? "OK" : cr.status);
