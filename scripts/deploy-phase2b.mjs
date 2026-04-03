// Phase 2B: Fetch 12 workflow templates from GitHub, hydrate with AJ Flooring IDs, deploy to n8n
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import https from "https";
import urlMod from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(__dirname, "kv-seed.json"), "utf-8"));
const state = JSON.parse(readFileSync(join(__dirname, "deploy-state.json"), "utf-8"));
const placeholders = state.placeholders;

const N8N_KEY = seed["n8n-api-key"];
const GH_TOKEN = seed["github-token"];
const N8N_BASE = "https://n8n.dakona.net/api/v1";
const GH_BASE = "https://api.github.com/repos/scubarichard/rpe-workflow-templates/contents";
const N8N_FOLDER_ID = "iMvolHM9IilDAcIj";

const TEMPLATES = [
  "workflow-v01-margin-guardrail.json",
  "workflow-v02-labor-cap-monitor.json",
  "workflow-v03-field-validation.json",
  "workflow-v04-job-completion.json",
  "workflow-v05-material-order.json",
  "workflow-v06-change-order-sync.json",
  "workflow-v07-payout-gate.json",
  "workflow-v08-co-paid-recalc.json",
  "workflow-v09-dashboard-feed.json",
  "workflow-v10-dashboard-feed-ghl.json",
  "workflow-v11-dashboard-live-json.json",
  "workflow-v12-signoff-receiver.json"
];

function httpReq(method, rawUrl, headers, postBody) {
  return new Promise((resolve, reject) => {
    const parsed = urlMod.parse(rawUrl);
    const data = postBody ? (typeof postBody === "string" ? postBody : JSON.stringify(postBody)) : null;
    const opts = {
      hostname: parsed.hostname, path: parsed.path, method,
      headers: Object.assign({}, headers, data ? { "Content-Length": Buffer.byteLength(data) } : {})
    };
    const req = https.request(opts, (res) => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(body); } catch {}
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json, text: body });
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function hydrate(templateStr, vars) {
  let result = templateStr;
  for (const [placeholder, value] of Object.entries(vars)) {
    result = result.split(placeholder).join(value || "");
  }
  return result;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

console.log("=== Phase 2B: Deploy Workflows to n8n ===\n");

const created = [];
const failed = [];

for (const templateName of TEMPLATES) {
  try {
    // 1. Fetch template from GitHub
    const ghR = await httpReq("GET", `${GH_BASE}/${templateName}`, {
      "Authorization": "token " + GH_TOKEN,
      "Accept": "application/vnd.github+json",
      "User-Agent": "n8n-rpe"
    });
    
    if (!ghR.ok) {
      console.log(`FAIL: ${templateName} — GitHub ${ghR.status}`);
      failed.push({ template: templateName, error: "GitHub " + ghR.status });
      continue;
    }

    // 2. Decode base64 content
    const templateStr = Buffer.from(ghR.json.content, "base64").toString("utf-8");

    // 3. Hydrate placeholders
    const hydratedStr = hydrate(templateStr, placeholders);
    const workflow = JSON.parse(hydratedStr);

    // 4. Prefix name with [AJ]
    workflow.name = "[AJ] " + (workflow.name || templateName.replace(".json", ""));

    // 5. Remove read-only fields
    delete workflow.id;
    delete workflow.tags;

    // 6. Create in n8n
    const createR = await httpReq("POST", `${N8N_BASE}/workflows`, {
      "X-N8N-API-KEY": N8N_KEY,
      "Content-Type": "application/json"
    }, workflow);

    if (!createR.ok) {
      console.log(`FAIL: ${workflow.name} — n8n ${createR.status} ${(createR.json?.message || createR.text).slice(0, 100)}`);
      failed.push({ template: templateName, name: workflow.name, error: "n8n " + createR.status });
      continue;
    }

    const wfId = createR.json.id;

    // 7. Move to AJ Flooring folder
    await httpReq("PUT", `${N8N_BASE}/workflows/${wfId}`, {
      "X-N8N-API-KEY": N8N_KEY,
      "Content-Type": "application/json"
    }, Object.assign({}, createR.json, {
      // n8n doesn't support folder move via API easily, we'll handle this separately
    }));

    // 8. Activate
    const actR = await httpReq("POST", `${N8N_BASE}/workflows/${wfId}/activate`, {
      "X-N8N-API-KEY": N8N_KEY
    });

    console.log(`OK: ${workflow.name} -> ${wfId} (active: ${actR.ok})`);
    created.push({
      name: workflow.name,
      id: wfId,
      template: templateName,
      active: actR.ok
    });

  } catch (e) {
    console.log(`ERR: ${templateName} — ${e.message}`);
    failed.push({ template: templateName, error: e.message });
  }

  await sleep(1000);
}

console.log(`\n=== Phase 2B Complete ===`);
console.log(`Created: ${created.length} / ${TEMPLATES.length}`);
console.log(`Failed: ${failed.length}`);

if (failed.length > 0) {
  console.log("\nFailed templates:");
  failed.forEach(f => console.log(`  ${f.template}: ${f.error}`));
}

// Save to state
state.phase = "2B";
state.created_workflows = created;
state.failed_workflows = failed;
writeFileSync(join(__dirname, "deploy-state.json"), JSON.stringify(state, null, 2));
console.log("\nState saved.");
