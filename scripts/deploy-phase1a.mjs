// Phase 1A: GHL Provisioning — Create custom fields + pipeline
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import https from "https";
import urlMod from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(__dirname, "kv-seed.json"), "utf-8"));

const GHL_TOKEN = seed["rpe-ajflooring-pit-token"];
const LOCATION_ID = "eWmOhK85TA8xb2HTiSh6";
const GHL_BASE = "https://services.leadconnectorhq.com";

function httpReq(method, rawUrl, headers, postBody) {
  return new Promise((resolve, reject) => {
    const parsed = urlMod.parse(rawUrl);
    const opts = { hostname: parsed.hostname, path: parsed.path, method, headers: headers || {} };
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
    if (postBody) req.write(typeof postBody === "string" ? postBody : JSON.stringify(postBody));
    req.end();
  });
}

const HEADERS = {
  "Authorization": `Bearer ${GHL_TOKEN}`,
  "Version": "2021-07-28",
  "Content-Type": "application/json"
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Custom Fields to create ──
const FIELDS = [
  { name: "Labor Budget", dataType: "NUMERICAL", key: "labor_budget" },
  { name: "Crew Payout", dataType: "NUMERICAL", key: "crew_payout" },
  { name: "Gross Margin %", dataType: "NUMERICAL", key: "gross_margin_pct" },
  { name: "Product Type", dataType: "TEXT", key: "product_type" },
  { name: "Material Cost", dataType: "NUMERICAL", key: "material_cost" },
  { name: "ClickUp Task ID", dataType: "TEXT", key: "clickup_task_id" },
  { name: "ClickUp Short ID", dataType: "TEXT", key: "clickup_short_id" },
  { name: "Completion Date", dataType: "TEXT", key: "completion_date" },
  { name: "Labor Cap %", dataType: "NUMERICAL", key: "labor_cap_pct" },
  { name: "Material SKU", dataType: "TEXT", key: "material_sku" },
  { name: "Material Order Total", dataType: "NUMERICAL", key: "material_order_total" },
  { name: "Order Date", dataType: "TEXT", key: "order_date" },
  { name: "Crew", dataType: "TEXT", key: "crew" },
  { name: "Photos Uploaded", dataType: "CHECKBOX", key: "photos_uploaded" },
  { name: "Signed Off", dataType: "CHECKBOX", key: "signed_off" },
  { name: "Go-Back Required", dataType: "CHECKBOX", key: "goback_required" }
];

console.log("=== Phase 1A: GHL Provisioning ===");
console.log("Location:", LOCATION_ID);
console.log("");

// ── Create custom fields ──
const fieldMap = {};
let fieldOk = 0, fieldFail = 0;

for (const field of FIELDS) {
  const r = await httpReq("POST", `${GHL_BASE}/locations/${LOCATION_ID}/customFields`, HEADERS, {
    name: field.name,
    dataType: field.dataType,
    model: "opportunity"
  });
  if (r.ok) {
    const id = r.json?.customField?.id || r.json?.id;
    fieldMap[field.key] = id;
    console.log(`  OK: ${field.name} -> ${id}`);
    fieldOk++;
  } else {
    console.log(`  FAIL: ${field.name} -> ${r.status} ${r.json?.message || r.text.slice(0,100)}`);
    fieldFail++;
  }
  await sleep(400);
}

console.log(`\nCustom fields: ${fieldOk} created, ${fieldFail} failed`);

// ── Create pipeline ──
console.log("\nCreating pipeline...");
const pipelineR = await httpReq("POST", `${GHL_BASE}/opportunities/pipelines`, HEADERS, {
  locationId: LOCATION_ID,
  name: "AJ Flooring Pipeline",
  stages: [
    { name: "New Lead", position: 0 },
    { name: "Estimate Sent", position: 1 },
    { name: "Contract Signed", position: 2 },
    { name: "In Production", position: 3 },
    { name: "Closed Won", position: 4 },
    { name: "Margin Review", position: 5 }
  ]
});

const stageMap = {};
let pipelineId = null;

if (pipelineR.ok) {
  const pipeline = pipelineR.json?.pipeline || pipelineR.json;
  pipelineId = pipeline?.id;
  console.log(`  OK: Pipeline -> ${pipelineId}`);
  const stages = pipeline?.stages || [];
  stages.forEach(s => {
    const key = s.name.toLowerCase().replace(/\s+/g, "_");
    stageMap[key] = s.id;
    console.log(`    Stage: ${s.name} -> ${s.id}`);
  });
} else {
  console.log(`  FAIL: Pipeline -> ${pipelineR.status} ${pipelineR.json?.message || pipelineR.text.slice(0,200)}`);
}

// ── Save output for next phase ──
const output = {
  phase: "1A",
  location_id: LOCATION_ID,
  custom_fields: fieldMap,
  pipeline_id: pipelineId,
  stages: stageMap,
  stats: { fields_created: fieldOk, fields_failed: fieldFail, pipeline_created: !!pipelineId }
};

writeFileSync(join(__dirname, "deploy-state.json"), JSON.stringify(output, null, 2));
console.log("\n=== Phase 1A Complete ===");
console.log("State saved to deploy-state.json");
console.log(JSON.stringify(output, null, 2));
