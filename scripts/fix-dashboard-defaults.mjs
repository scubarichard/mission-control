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

// Get current file
const fr = await httpReq("GET", "https://api.github.com/repos/scubarichard/aj-flooring-dashboard/contents/index.html", GH_HEADERS);
let html = Buffer.from(fr.json.content, "base64").toString("utf-8");

// Fix hardcoded 40.1% margin
const before = html.includes("40.1%");
html = html.split("40.1%").join("0.0%");
console.log("40.1% found and replaced:", before);

// Fix hardcoded Completed MTD: 1
const before2 = html.includes(">1</div>");
// Be careful to only replace the Completed MTD one
html = html.replace(
  /(<div class="card-label">Completed MTD<\/div>\s*<div class="card-value[^"]*">)1(<\/div>)/,
  "$10$2"
);
console.log("Completed MTD 1 found:", before2);

// Verify
console.log("Still has 40.1%:", html.includes("40.1%"));
console.log("Check Completed MTD section:", html.includes("Completed MTD"));

// Commit
const cr = await httpReq("PUT", "https://api.github.com/repos/scubarichard/aj-flooring-dashboard/contents/index.html", GH_HEADERS, {
  message: "fix: replace hardcoded 40.1% and Completed MTD=1 with zero defaults",
  content: Buffer.from(html).toString("base64"),
  sha: fr.json.sha
});
console.log("Commit:", cr.ok ? "OK" : cr.status + " " + JSON.stringify(cr.json?.message).slice(0,100));
