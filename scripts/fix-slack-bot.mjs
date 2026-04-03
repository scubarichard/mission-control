import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(__dirname, "kv-seed.json"), "utf-8"));
const KEY = seed["n8n-api-key"];
const BASE = "https://n8n.dakona.net/api/v1/workflows";
const WF_ID = "j6znmoVMC7a6QKFM";
const ALLOW = ["name","nodes","connections","settings","staticData","pinData"];

const r = await fetch(`${BASE}/${WF_ID}`, {headers:{"X-N8N-API-KEY":KEY}});
const wf = await r.json();

// Update Validate & Normalize to accept slack_channel_id and slack_bot_token
const validate = wf.nodes.find(n => n.name === "Validate & Normalize");
if (validate) {
  let code = validate.parameters.jsCode;
  if (!code.includes("slack_channel_id")) {
    code = code.replace(
      "const slack_webhook = (b.slack_webhook || '').trim();",
      "const slack_webhook = (b.slack_webhook || '').trim();\nconst slack_channel_id = (b.slack_channel_id || '').trim();\nconst slack_bot_token = (b.slack_bot_token || '').trim();"
    );
    code = code.replace(
      "config: { headcount, margin_target, labor_cap_pct, crew_names, slack_webhook, n8n_folder_id, github_token, n8n_api_key },",
      "config: { headcount, margin_target, labor_cap_pct, crew_names, slack_webhook, slack_channel_id, slack_bot_token, n8n_folder_id, github_token, n8n_api_key },"
    );
    console.log("OK: Added slack_channel_id + slack_bot_token to Validate");
  } else {
    console.log("SKIP: slack_channel_id already in Validate");
  }
  validate.parameters.jsCode = code;
}

// Update Pre-Flight to test Slack bot token + channel
const pf = wf.nodes.find(n => n.name === "Pre-Flight Checks");
if (pf) {
  pf.parameters.jsCode = pf.parameters.jsCode.replace(
    `// ── 8. Slack ──
if (ctx.config.slack_webhook) {
  checks.push({ platform: 'Slack', status: 'SKIP', message: 'Webhook provided — not tested in pre-flight' });
} else {
  checks.push({ platform: 'Slack', status: 'SKIP', message: 'No webhook URL provided' });
}`,
    `// ── 8. Slack ──
var slackToken = (ctx.config && ctx.config.slack_bot_token) || '';
var slackChannel = (ctx.config && ctx.config.slack_channel_id) || '';
if (slackToken && slackChannel) {
  try {
    var slackR = await httpGet('https://slack.com/api/conversations.info?channel=' + slackChannel, {
      'Authorization': 'Bearer ' + slackToken
    });
    if (slackR.ok && slackR.json && slackR.json.ok) {
      checks.push({ platform: 'Slack', status: 'PASS', message: 'Channel: #' + (slackR.json.channel && slackR.json.channel.name || slackChannel) });
    } else {
      checks.push({ platform: 'Slack', status: 'FAIL', message: 'Channel check failed: ' + ((slackR.json && slackR.json.error) || 'HTTP ' + slackR.status) });
    }
  } catch(e) {
    checks.push({ platform: 'Slack', status: 'FAIL', message: e.message });
  }
} else if (ctx.config.slack_webhook) {
  checks.push({ platform: 'Slack', status: 'SKIP', message: 'Webhook provided — not tested in pre-flight' });
} else {
  checks.push({ platform: 'Slack', status: 'SKIP', message: 'No Slack config provided' });
}`
  );
  console.log("OK: Updated Slack pre-flight to use bot token + channel");
}

const body = {};
for (const k of ALLOW) if (wf[k] !== undefined) body[k] = wf[k];
const p = await fetch(`${BASE}/${WF_ID}`, {
  method: "PUT",
  headers: {"X-N8N-API-KEY":KEY,"Content-Type":"application/json"},
  body: JSON.stringify(body)
});
console.log("PUT:", p.ok ? "OK" : p.status);
