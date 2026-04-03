// Phase 2A: Build master placeholder → value map for workflow template hydration
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(__dirname, "kv-seed.json"), "utf-8"));
const state = JSON.parse(readFileSync(join(__dirname, "deploy-state.json"), "utf-8"));

const cf = state.custom_fields;
const cu = state.clickup;
const stages = state.stages;
const slug = "aj-flooring";

const placeholders = {
  // Client
  "{{client_name}}": "AJ Flooring Solutions",
  "{{client_slug}}": slug,
  "{{slug}}": slug,
  "{{owner_name}}": "",
  "{{owner_email}}": "",
  "{{headcount}}": "2",
  "{{margin_target}}": "40",
  "{{margin_warning}}": "35",
  "{{labor_cap_pct}}": "15",
  "{{labor_warning_pct}}": "12",
  "{{crew_names_json}}": JSON.stringify({"Crew A": "Lead 1"}),

  // GHL
  "{{ghl_token}}": seed["rpe-ajflooring-pit-token"],
  "{{ghl_location_id}}": state.location_id,
  "{{ghl_pipeline_id}}": state.pipeline_id,

  // GHL custom fields
  "{{ghl_cf_labor_budget}}": cf.labor_budget,
  "{{ghl_cf_crew_payout}}": cf.crew_payout,
  "{{ghl_cf_gross_margin_pct}}": cf.gross_margin_pct,
  "{{ghl_cf_product_type}}": cf.product_type,
  "{{ghl_cf_material_cost}}": cf.material_cost,
  "{{ghl_cf_clickup_task_id}}": cf.clickup_task_id,
  "{{ghl_cf_clickup_short_id}}": cf.clickup_short_id,
  "{{ghl_cf_completion_date}}": cf.completion_date,
  "{{ghl_cf_labor_cap_pct}}": cf.labor_cap_pct,
  "{{ghl_cf_material_sku}}": cf.material_sku,
  "{{ghl_cf_material_order_total}}": cf.material_order_total,
  "{{ghl_cf_order_date}}": cf.order_date,
  "{{ghl_cf_crew}}": cf.crew,
  "{{ghl_cf_photos_uploaded}}": cf.photos_uploaded,
  "{{ghl_cf_signed_off}}": cf.signed_off,
  "{{ghl_cf_goback_required}}": cf.goback_required,

  // GHL stages
  "{{ghl_stage_new_lead}}": stages.new_lead,
  "{{ghl_stage_estimate_sent}}": stages.estimate_sent,
  "{{ghl_stage_contract_signed}}": stages.contract_signed,
  "{{ghl_stage_in_production}}": stages.in_production,
  "{{ghl_stage_closed_won}}": stages.closed_won,
  "{{ghl_stage_margin_review}}": stages.margin_review,

  // ClickUp
  "{{clickup_token}}": seed["clickup-api-key"],
  "{{clickup_team_id}}": "9017745115",
  "{{clickup_space_id}}": cu.space_id || "MISSING",
  "{{clickup_folder_active_jobs}}": cu.folders?.active_jobs || "MISSING",
  "{{clickup_folder_completed_jobs}}": cu.folders?.completed_jobs || "MISSING",
  "{{clickup_folder_change_orders}}": cu.folders?.change_orders || "MISSING",
  "{{clickup_list_current_pipeline}}": cu.lists?.current_pipeline || "MISSING",
  "{{clickup_list_starting_this_week}}": cu.lists?.starting_this_week || "MISSING",
  "{{clickup_list_completed}}": cu.lists?.completed || "MISSING",
  "{{clickup_list_pending_cos}}": cu.lists?.pending_cos || "MISSING",

  // Google
  "{{sheet_id}}": "MANUAL_SETUP_REQUIRED",

  // n8n
  "{{n8n_base}}": "https://n8n.dakona.net",
  "{{n8n_api_key}}": seed["n8n-api-key"],

  // GitHub
  "{{github_owner}}": "scubarichard",
  "{{github_token}}": seed["github-token"],

  // Slack
  "{{slack_webhook}}": "",
  "{{slack_bot_token}}": seed["rpe-slack-token"],
  "{{slack_channel_id}}": "C0AAEUK10P4"
};

// Check for missing values
const missing = Object.entries(placeholders)
  .filter(([k, v]) => v === "MISSING" || v === undefined || v === null)
  .map(([k]) => k);

console.log("=== Phase 2A: Build ID Map ===\n");
console.log("Total placeholders:", Object.keys(placeholders).length);
console.log("Missing:", missing.length > 0 ? missing.join(", ") : "None");
console.log("");

// Print the map
for (const [k, v] of Object.entries(placeholders)) {
  const display = (v || "").length > 40 ? (v || "").slice(0, 37) + "..." : v;
  const flag = v === "MISSING" || v === undefined ? " ← MISSING" : "";
  console.log(`  ${k} = ${display}${flag}`);
}

// Save to state
state.phase = "2A";
state.placeholders = placeholders;
state.missing_ids = missing;

writeFileSync(join(__dirname, "deploy-state.json"), JSON.stringify(state, null, 2));
console.log("\n=== Phase 2A Complete ===");
console.log("Placeholder map saved to deploy-state.json");
if (missing.length > 0) {
  console.log("WARNING:", missing.length, "placeholders still MISSING — resolve before Phase 2B");
}
