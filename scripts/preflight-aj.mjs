import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(__dirname, "kv-seed.json"), "utf-8"));

const payload = {
  client_name: "AJ Flooring Solutions",
  client_slug: "aj-flooring",
  owner_name: "",
  owner_email: "placeholder@ajflooring.com",
  owner_phone: "",
  ghl_token: seed["rpe-ajflooring-pit-token"],
  ghl_location_id: "eWmOhK85TA8xb2HTiSh6",
  clickup_team_id: "9017745115",
  clickup_token: seed["clickup-api-key"],
  slack_channel_id: "C0AAEUK10P4",
  slack_bot_token: seed["rpe-slack-token"],
  headcount: 2,
  margin_target: 40,
  labor_cap_pct: 15,
  crew_names_json: '{"Crew A":"Lead 1"}',
  github_token: seed["github-token"],
  n8n_api_key: seed["n8n-api-key"],
  n8n_folder_id: "iMvolHM9IilDAcIj",
  preflight_only: true
};

try {
  const r = await fetch("https://n8n.dakona.net/webhook/rpe-onboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  console.log("Status:", r.status);
  const d = await r.text();
  if (d) {
    try { console.log(JSON.stringify(JSON.parse(d), null, 2)); }
    catch { console.log("Raw:", d.slice(0, 2000)); }
  } else {
    console.log("Empty response");
  }
} catch (e) {
  console.log("Error:", e.message);
}
