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

// Show the current state of the entire new Chart call in initCFOChart
const funcStart = html.indexOf("function initCFOChart()");
const newChartStart = html.indexOf("new Chart(canvas,{", funcStart);
// Find the matching );
let depth = 0;
let chartEnd = newChartStart;
for (let i = newChartStart; i < html.length; i++) {
  if (html[i] === "(") depth++;
  if (html[i] === ")") { depth--; if (depth === 0) { chartEnd = i + 2; break; } }
}

const currentChart = html.slice(newChartStart, chartEnd);
console.log("Current Chart call:");
console.log(currentChart);
console.log("\n---");

// Replace the entire Chart call with a correct version
const correctChart = `new Chart(canvas,{
    type:"bar",
    data:{labels:["Labor Budget","Labor Cost","Variance"],datasets:[{data:[0,0,0],backgroundColor:[gold,orange,green],borderRadius:6}]},
    options:{plugins:{legend:{display:false}},scales:{y:{ticks:{callback:function(v){return "$"+Math.round(v/1000)+"K";}},grid:{color:"#f0f0f0"}},x:{grid:{display:false}}}}
  });`;

html = html.slice(0, newChartStart) + correctChart + html.slice(chartEnd);
console.log("Replaced with correct Chart call");

// Verify balance
const funcArea = html.slice(html.indexOf("function initCFOChart()"), html.indexOf("function initCFOChart()") + 800);
let brackets = 0;
for (let i = 0; i < funcArea.length; i++) {
  if (funcArea[i] === "{") brackets++;
  if (funcArea[i] === "}") brackets--;
  if (brackets === 0 && i > 10) break;
}
console.log("Bracket balance:", brackets === 0 ? "OK" : "STILL OFF (" + brackets + ")");

const cr = await httpReq("PUT", "https://api.github.com/repos/scubarichard/aj-flooring-dashboard/contents/index.html", GH_HEADERS, {
  message: "fix: correct CFO chart syntax - restore full Chart() call",
  content: Buffer.from(html).toString("base64"),
  sha: fr.json.sha
});
console.log("Commit:", cr.ok ? "OK" : cr.status);
