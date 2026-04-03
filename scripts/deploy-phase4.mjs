// Phase 4: Generate deployment manifest + build notes, commit to GitHub
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import https from "https";
import urlMod from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(__dirname, "kv-seed.json"), "utf-8"));
const state = JSON.parse(readFileSync(join(__dirname, "deploy-state.json"), "utf-8"));

const GH_TOKEN = seed["github-token"];
const OWNER = "scubarichard";
const REPO = "rpe-systems";
const GH_BASE = "https://api.github.com";
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

const sleep = ms => new Promise(r => setTimeout(r, ms));

console.log("=== Phase 4: Deployment Manifest ===\n");

// Build manifest
const manifest = {
  deployment_id: state.placeholders["{{client_slug}}"] + "-" + Date.now().toString(36),
  client_name: "AJ Flooring Solutions",
  client_slug: "aj-flooring",
  deployed_at: new Date().toISOString(),
  status: "COMPLETE",

  ghl: {
    location_id: state.location_id,
    pipeline_id: state.pipeline_id,
    stages: state.stages,
    custom_fields: state.custom_fields,
    pit_token_key: "rpe-ajflooring-pit-token"
  },

  clickup: {
    team_id: "9017745115",
    space_id: state.clickup.space_id,
    folders: state.clickup.folders,
    lists: state.clickup.lists,
    custom_fields: state.clickup.custom_fields
  },

  n8n: {
    folder_id: "iMvolHM9IilDAcIj",
    workflows: (state.created_workflows || []).map(w => ({
      name: w.name,
      id: w.id,
      template: w.template,
      active: w.active
    }))
  },

  google: {
    sheet_id: state.google_sheet_id,
    sheet_url: "https://docs.google.com/spreadsheets/d/" + state.google_sheet_id
  },

  dashboard: state.dashboard,

  slack: {
    channel_id: "C0AAEUK10P4",
    channel_name: "#01-operations-engine"
  },

  config: {
    headcount: 2,
    margin_target: 40,
    margin_warning: 35,
    labor_cap_pct: 15,
    labor_warning_pct: 12,
    crew_names: { "Crew A": "Lead 1" }
  },

  manual_steps: [
    "Apply GHL snapshot (RPE_Flooring_Operations_v1) to AJ Flooring subaccount for dashboards/widgets",
    "Verify dashboard loads at " + state.dashboard.url,
    "Update crew names and headcount when AJ Flooring provides actual crew info",
    "Configure GHL workflow triggers (stage changes → n8n webhooks)",
    "Test signoff form with a sample opportunity",
    "Move 12 [AJ] workflows into the AJ Flooring n8n folder (iMvolHM9IilDAcIj)",
    "Set up custom domain for dashboard if needed (e.g., aj-flooring.rpe-systems.1altx.ai)"
  ]
};

// Build markdown
const md = `# Deployment: AJ Flooring Solutions

| Field | Value |
|---|---|
| **Deployment ID** | \`${manifest.deployment_id}\` |
| **Status** | ${manifest.status} |
| **Deployed** | ${manifest.deployed_at} |
| **Client** | AJ Flooring Solutions |

## URLs

- **Dashboard (CEO)**: ${manifest.dashboard.url}?view=ceo
- **Dashboard (GM)**: ${manifest.dashboard.url}?view=gm
- **Dashboard (CFO)**: ${manifest.dashboard.url}?view=cfo
- **Signoff Form**: ${manifest.dashboard.signoff_url}
- **GHL Location**: https://app.gohighlevel.com/v2/location/${manifest.ghl.location_id}/launchpad
- **Google Sheet**: ${manifest.google.sheet_url}
- **ClickUp Space**: https://app.clickup.com/9017745115/v/s/${manifest.clickup.space_id}
- **GitHub Repo**: https://github.com/${manifest.dashboard.repo}

## GHL

- Location ID: \`${manifest.ghl.location_id}\`
- Pipeline ID: \`${manifest.ghl.pipeline_id}\`
- Custom Fields: ${Object.keys(manifest.ghl.custom_fields).length}
- Stages:
${Object.entries(manifest.ghl.stages).map(([k, v]) => `  - ${k}: \`${v}\``).join("\n")}

## ClickUp

- Space ID: \`${manifest.clickup.space_id}\`
- Folders:
${Object.entries(manifest.clickup.folders).map(([k, v]) => `  - ${k}: \`${v}\``).join("\n")}
- Lists:
${Object.entries(manifest.clickup.lists).map(([k, v]) => `  - ${k}: \`${v}\``).join("\n")}

## n8n Workflows

${manifest.n8n.workflows.map(w => `- [${w.active ? "ON" : "OFF"}] ${w.name} (\`${w.id}\`)`).join("\n")}

## Operations Config

- Headcount: ${manifest.config.headcount}
- Margin Target: ${manifest.config.margin_target}%
- Labor Cap: ${manifest.config.labor_cap_pct}%
- Crews: ${JSON.stringify(manifest.config.crew_names)}

## Manual Steps Remaining

${manifest.manual_steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

---
*Generated by RPE Systems v20 Onboarding Orchestrator — Phase 4*
*Deployed by Forge agent on ${manifest.deployed_at}*
`;

console.log("Manifest built.");
console.log("Committing to GitHub...");

// Commit JSON
const jsonContent = Buffer.from(JSON.stringify(manifest, null, 2)).toString("base64");
const jsonR = await httpReq("PUT", `${GH_BASE}/repos/${OWNER}/${REPO}/contents/deployments/aj-flooring.json`, GH_HEADERS, {
  message: "Deploy manifest: AJ Flooring Solutions",
  content: jsonContent
});
if (jsonR.ok) {
  console.log("  OK: aj-flooring.json");
} else {
  // Update if exists
  const existing = await httpReq("GET", `${GH_BASE}/repos/${OWNER}/${REPO}/contents/deployments/aj-flooring.json`, GH_HEADERS);
  if (existing.ok) {
    const updateR = await httpReq("PUT", `${GH_BASE}/repos/${OWNER}/${REPO}/contents/deployments/aj-flooring.json`, GH_HEADERS, {
      message: "Update deploy manifest: AJ Flooring Solutions",
      content: jsonContent,
      sha: existing.json.sha
    });
    console.log("  " + (updateR.ok ? "OK: Updated" : "FAIL: " + updateR.status));
  } else {
    console.log("  FAIL:", jsonR.status, jsonR.json?.message?.slice(0, 100));
  }
}

await sleep(1000);

// Commit MD
const mdContent = Buffer.from(md).toString("base64");
const mdR = await httpReq("PUT", `${GH_BASE}/repos/${OWNER}/${REPO}/contents/deployments/aj-flooring.md`, GH_HEADERS, {
  message: "Build notes: AJ Flooring Solutions",
  content: mdContent
});
if (mdR.ok) {
  console.log("  OK: aj-flooring.md");
} else {
  const existing = await httpReq("GET", `${GH_BASE}/repos/${OWNER}/${REPO}/contents/deployments/aj-flooring.md`, GH_HEADERS);
  if (existing.ok) {
    const updateR = await httpReq("PUT", `${GH_BASE}/repos/${OWNER}/${REPO}/contents/deployments/aj-flooring.md`, GH_HEADERS, {
      message: "Update build notes: AJ Flooring Solutions",
      content: mdContent,
      sha: existing.json.sha
    });
    console.log("  " + (updateR.ok ? "OK: Updated" : "FAIL: " + updateR.status));
  } else {
    console.log("  FAIL:", mdR.status, mdR.json?.message?.slice(0, 100));
  }
}

// Update state
state.phase = "4";
state.manifest = manifest;
writeFileSync(join(__dirname, "deploy-state.json"), JSON.stringify(state, null, 2));

console.log("\n=== Phase 4 Complete ===");
console.log("Manifest:", `https://github.com/${OWNER}/${REPO}/blob/main/deployments/aj-flooring.json`);
console.log("Build notes:", `https://github.com/${OWNER}/${REPO}/blob/main/deployments/aj-flooring.md`);
console.log("\n=== DEPLOYMENT COMPLETE ===");
console.log("Manual steps remaining:", manifest.manual_steps.length);
manifest.manual_steps.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
