// Phase 1B: ClickUp Provisioning — Create space, folders, lists, custom fields
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import https from "https";
import urlMod from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(__dirname, "kv-seed.json"), "utf-8"));
const state = JSON.parse(readFileSync(join(__dirname, "deploy-state.json"), "utf-8"));
const TOKEN = seed["clickup-api-key"];
const TEAM_ID = "9017745115";
const CU_BASE = "https://api.clickup.com/api/v2";

function httpReq(method, rawUrl, headers, postBody) {
  return new Promise((resolve, reject) => {
    const parsed = urlMod.parse(rawUrl);
    const data = postBody ? JSON.stringify(postBody) : null;
    const opts = {
      hostname: parsed.hostname, path: parsed.path, method,
      headers: Object.assign({}, headers, data ? {"Content-Length": Buffer.byteLength(data)} : {})
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

const HEADERS = { "Authorization": TOKEN, "Content-Type": "application/json" };
const sleep = ms => new Promise(r => setTimeout(r, ms));

console.log("=== Phase 1B: ClickUp Provisioning ===\n");

// ── 1. Create Space ──
console.log("Creating space...");
const spaceR = await httpReq("POST", `${CU_BASE}/team/${TEAM_ID}/space`, HEADERS, {
  name: "AJ Flooring Solutions",
  multiple_assignees: true,
  features: { due_dates: { enabled: true }, time_tracking: { enabled: false } }
});

if (!spaceR.ok) {
  console.log("FAIL: Space creation ->", spaceR.status, spaceR.json?.err || spaceR.text.slice(0, 200));
  process.exit(1);
}
const spaceId = spaceR.json.id;
console.log("  OK: Space ->", spaceId, spaceR.json.name);
await sleep(500);

// ── 2. Create Folders ──
console.log("\nCreating folders...");
const FOLDERS = ["Active Jobs", "Completed Jobs", "Change Orders", "Dashboard Development"];
const folderMap = {};

for (const fname of FOLDERS) {
  const r = await httpReq("POST", `${CU_BASE}/space/${spaceId}/folder`, HEADERS, { name: fname });
  if (r.ok) {
    const key = fname.toLowerCase().replace(/\s+/g, "_");
    folderMap[key] = r.json.id;
    console.log(`  OK: ${fname} -> ${r.json.id}`);
  } else {
    console.log(`  FAIL: ${fname} -> ${r.status} ${r.json?.err || r.text.slice(0, 100)}`);
  }
  await sleep(300);
}

// ── 3. Create Lists in folders ──
console.log("\nCreating lists...");
const LISTS = {
  active_jobs: ["Current Pipeline", "Starting This Week"],
  completed_jobs: ["Completed"],
  change_orders: ["Pending COs", "Approved COs"],
  dashboard_development: ["Backlog", "In Progress"]
};

const listMap = {};
for (const [folderKey, listNames] of Object.entries(LISTS)) {
  const folderId = folderMap[folderKey];
  if (!folderId) { console.log(`  SKIP: No folder for ${folderKey}`); continue; }
  for (const lname of listNames) {
    const r = await httpReq("POST", `${CU_BASE}/folder/${folderId}/list`, HEADERS, { name: lname });
    if (r.ok) {
      const key = lname.toLowerCase().replace(/\s+/g, "_");
      listMap[key] = r.json.id;
      console.log(`  OK: ${lname} -> ${r.json.id}`);
    } else {
      console.log(`  FAIL: ${lname} -> ${r.status} ${r.json?.err || r.text.slice(0, 100)}`);
    }
    await sleep(300);
  }
}

// ── 4. Create custom fields on Current Pipeline list ──
console.log("\nCreating custom fields...");
const pipelineListId = listMap["current_pipeline"];
const cuFieldMap = {};

if (pipelineListId) {
  const CU_FIELDS = [
    { name: "GHL Opportunity ID", type: "short_text" },
    { name: "Job Value", type: "currency" },
    { name: "Gross Margin %", type: "number" },
    { name: "Labor Budget", type: "currency" },
    { name: "Crew Payout", type: "currency" },
    { name: "Crew Assignment", type: "short_text" }
  ];

  for (const f of CU_FIELDS) {
    const r = await httpReq("POST", `${CU_BASE}/list/${pipelineListId}/field`, HEADERS, {
      name: f.name,
      type: f.type
    });
    if (r.ok) {
      const key = f.name.toLowerCase().replace(/[\s%]+/g, "_");
      cuFieldMap[key] = r.json.id;
      console.log(`  OK: ${f.name} -> ${r.json.id}`);
    } else {
      console.log(`  FAIL: ${f.name} -> ${r.status} ${r.json?.err || r.text.slice(0, 100)}`);
    }
    await sleep(300);
  }
} else {
  console.log("  SKIP: No Current Pipeline list found");
}

// ── Save state ──
state.phase = "1B";
state.clickup = {
  space_id: spaceId,
  folders: folderMap,
  lists: listMap,
  custom_fields: cuFieldMap
};
state.stats.clickup_space_created = true;

writeFileSync(join(__dirname, "deploy-state.json"), JSON.stringify(state, null, 2));
console.log("\n=== Phase 1B Complete ===");
console.log("Space:", spaceId);
console.log("Folders:", Object.keys(folderMap).length);
console.log("Lists:", Object.keys(listMap).length);
console.log("Custom fields:", Object.keys(cuFieldMap).length);
