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

// Find and replace the hardcoded CHANGE_ORDERS array
const coStart = html.indexOf("var CHANGE_ORDERS");
if (coStart !== -1) {
  // Find the closing ];
  const coEnd = html.indexOf("];", coStart) + 2;
  const oldBlock = html.slice(coStart, coEnd);
  console.log("Found CHANGE_ORDERS block (" + oldBlock.length + " chars):");
  console.log(oldBlock.slice(0, 300) + "...");
  
  // Replace with empty array
  html = html.slice(0, coStart) + "var CHANGE_ORDERS = [];" + html.slice(coEnd);
  console.log("\nReplaced with empty array");
} else {
  console.log("CHANGE_ORDERS not found");
}

// Commit
const cr = await httpReq("PUT", "https://api.github.com/repos/scubarichard/aj-flooring-dashboard/contents/index.html", GH_HEADERS, {
  message: "fix: clear hardcoded CHANGE_ORDERS array (had ClickUp URLs from template space)",
  content: Buffer.from(html).toString("base64"),
  sha: fr.json.sha
});
console.log("Commit:", cr.ok ? "OK" : cr.status);
