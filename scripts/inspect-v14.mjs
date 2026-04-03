import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(__dirname, "kv-seed.json"), "utf-8"));
const KEY = seed["n8n-api-key"];

const r = await fetch(`https://n8n.dakona.net/api/v1/workflows/OUpro4bCRTQstFC6`, {
  headers: {"X-N8N-API-KEY": KEY}
});
const wf = await r.json();
const code = wf.nodes.find(n => n.name === "Build GHL Snapshot");
console.log(code.parameters.jsCode);
