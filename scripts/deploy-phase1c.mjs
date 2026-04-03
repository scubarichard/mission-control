// Phase 1C: Copy Google Sheet template via n8n — single Code node approach
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(__dirname, "kv-seed.json"), "utf-8"));
const state = JSON.parse(readFileSync(join(__dirname, "deploy-state.json"), "utf-8"));
const KEY = seed["n8n-api-key"];
const BASE = "https://n8n.dakona.net/api/v1";

const TEMPLATE_SHEET_ID = "1R7ICwjWEEO_FGzAxMtq0fR7ey6TSlpPjbSdPLQ264yg";
const DRIVE_CRED_ID = "0MjijtGwtAOKVNBE";
const SHEETS_CRED_ID = "fhAvmmHWXh2VIsWu";

// Build workflow: Webhook -> Google Drive (create folder) -> Google Drive (subfolder) -> Google Drive (copy file) -> Code (format) -> Respond
// Use manual trigger + Google Drive nodes without Respond to avoid the error
const wf = {
  name: "__phase1c_sheet_copy",
  nodes: [
    {
      parameters: { httpMethod: "POST", path: "phase1c-run", options: {} },
      name: "Trigger",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [250, 300],
      webhookId: "phase1c-run"
    },
    {
      parameters: {
        resource: "folder",
        operation: "create",
        name: "RPE Clients",
        options: {}
      },
      name: "RPE Folder",
      type: "n8n-nodes-base.googleDrive",
      typeVersion: 3,
      position: [500, 300],
      credentials: { googleDriveOAuth2Api: { id: DRIVE_CRED_ID, name: "Google Drive account" } }
    },
    {
      parameters: {
        resource: "folder",
        operation: "create",
        name: "AJ Flooring",
        options: {},
        parent: ["={{ $json.id }}"]
      },
      name: "AJ Folder",
      type: "n8n-nodes-base.googleDrive",
      typeVersion: 3,
      position: [750, 300],
      credentials: { googleDriveOAuth2Api: { id: DRIVE_CRED_ID, name: "Google Drive account" } }
    },
    {
      parameters: {
        resource: "file",
        operation: "copy",
        fileId: { __rl: true, value: TEMPLATE_SHEET_ID, mode: "id" },
        name: "AJ Flooring — Operations Dashboard",
        parent: ["={{ $json.id }}"],
        options: {}
      },
      name: "Copy Sheet",
      type: "n8n-nodes-base.googleDrive",
      typeVersion: 3,
      position: [1000, 300],
      credentials: { googleDriveOAuth2Api: { id: DRIVE_CRED_ID, name: "Google Drive account" } }
    }
  ],
  connections: {
    "Trigger": { main: [[{ node: "RPE Folder", type: "main", index: 0 }]] },
    "RPE Folder": { main: [[{ node: "AJ Folder", type: "main", index: 0 }]] },
    "AJ Folder": { main: [[{ node: "Copy Sheet", type: "main", index: 0 }]] }
  },
  settings: {}
};

// Create + activate
const cr = await fetch(`${BASE}/workflows`, {
  method: "POST",
  headers: { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" },
  body: JSON.stringify(wf)
});
const created = await cr.json();
console.log("Created:", created.id);

await fetch(`${BASE}/workflows/${created.id}/activate`, {
  method: "POST", headers: { "X-N8N-API-KEY": KEY }
});
await new Promise(r => setTimeout(r, 3000));

// Trigger
console.log("Running...");
const tr = await fetch("https://n8n.dakona.net/webhook/phase1c-run", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}"
});
console.log("Webhook status:", tr.status);

// Wait for execution to complete
await new Promise(r => setTimeout(r, 5000));

// Check latest execution
const exr = await fetch(`${BASE}/executions?workflowId=${created.id}&limit=1`, {
  headers: { "X-N8N-API-KEY": KEY }
});
const exd = await exr.json();
const ex = exd.data[0];
console.log("Execution:", ex.id, "Status:", ex.status);

if (ex.status === "success") {
  // Get execution data to find the sheet ID
  const exDetail = await fetch(`${BASE}/executions/${ex.id}?includeData=true`, {
    headers: { "X-N8N-API-KEY": KEY }
  });
  const detail = await exDetail.json();
  const runs = detail.data?.resultData?.runData || {};
  
  // Get Copy Sheet output
  const copyData = runs["Copy Sheet"];
  if (copyData) {
    const output = copyData[0]?.data?.main?.[0]?.[0]?.json;
    if (output) {
      console.log("\nSheet copied!");
      console.log("Sheet ID:", output.id);
      console.log("Sheet Name:", output.name);
      console.log("URL: https://docs.google.com/spreadsheets/d/" + output.id);
      
      // Update state
      state.phase = "1C";
      state.placeholders["{{sheet_id}}"] = output.id;
      state.google_sheet_id = output.id;
      writeFileSync(join(__dirname, "deploy-state.json"), JSON.stringify(state, null, 2));
      console.log("State updated.");
    }
  }
} else {
  // Check for errors
  const exDetail = await fetch(`${BASE}/executions/${ex.id}?includeData=true`, {
    headers: { "X-N8N-API-KEY": KEY }
  });
  const detail = await exDetail.json();
  const runs = detail.data?.resultData?.runData || {};
  for (const [node, data] of Object.entries(runs)) {
    const last = data[data.length-1];
    if (last?.error) console.log(node, "-> ERROR:", last.error.message.slice(0, 300));
    else console.log(node, "-> ok");
  }
}

// Cleanup
await fetch(`${BASE}/workflows/${created.id}/deactivate`, {
  method: "POST", headers: { "X-N8N-API-KEY": KEY }
});
await fetch(`${BASE}/workflows/${created.id}`, {
  method: "DELETE", headers: { "X-N8N-API-KEY": KEY }
});
console.log("Cleaned up");
