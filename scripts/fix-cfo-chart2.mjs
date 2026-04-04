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

// Find the current CFO chart data
const cfoIdx = html.indexOf("initCFOChart");
const chartDataIdx = html.indexOf("datasets:[{data:", cfoIdx);
if (chartDataIdx !== -1) {
  const dataStart = html.indexOf("[", chartDataIdx + 16);
  const dataEnd = html.indexOf("]", dataStart) + 1;
  const currentData = html.slice(dataStart, dataEnd);
  console.log("Current CFO chart data:", currentData);
}

// Find and replace the entire datasets data array - whatever it currently is
// Look for the pattern within initCFOChart function
const funcStart = html.indexOf("function initCFOChart()");
const funcDatasets = html.indexOf("datasets:[{data:", funcStart);
if (funcDatasets !== -1) {
  const arrStart = funcDatasets + "datasets:[{data:".length;
  // Find the matching ] for the data array
  let depth = 0;
  let arrEnd = arrStart;
  for (let i = arrStart; i < html.length; i++) {
    if (html[i] === "[") depth++;
    if (html[i] === "]") {
      if (depth === 0) { arrEnd = i + 1; break; }
      depth--;
    }
  }
  const oldData = html.slice(arrStart, arrEnd);
  const newData = "[0,0,0]";
  
  console.log("Replacing:", oldData.slice(0, 200));
  console.log("With:", newData);
  
  html = html.slice(0, arrStart) + newData + html.slice(arrEnd);
}

const cr = await httpReq("PUT", "https://api.github.com/repos/scubarichard/aj-flooring-dashboard/contents/index.html", GH_HEADERS, {
  message: "fix: force CFO labor chart to [0,0,0] for clean start",
  content: Buffer.from(html).toString("base64"),
  sha: fr.json.sha
});
console.log("Commit:", cr.ok ? "OK" : cr.status);
