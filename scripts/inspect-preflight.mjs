import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(__dirname, "kv-seed.json"), "utf-8"));
const KEY = seed["n8n-api-key"];

const r = await fetch(`https://n8n.dakona.net/api/v1/workflows/j6znmoVMC7a6QKFM`, {
  headers: {"X-N8N-API-KEY": KEY}
});
const wf = await r.json();
const pf = wf.nodes.find(n => n.name === "Pre-Flight Checks");
const code = pf.parameters.jsCode;

console.log("Length:", code.length);
console.log("Has backticks:", code.includes("`"));
console.log("Has fetch(:", code.includes("fetch("));
console.log("Has await fetch:", code.includes("await fetch"));
console.log("---First 500 chars---");
console.log(code.slice(0, 500));
