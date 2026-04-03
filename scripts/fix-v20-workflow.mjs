import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(__dirname, "kv-seed.json"), "utf-8"));
const API_KEY = seed["n8n-api-key"];
const BASE = "https://n8n.dakona.net/api/v1/workflows";
const WF_ID = "j6znmoVMC7a6QKFM";
const ALLOW = ["name", "nodes", "connections", "settings", "staticData", "pinData"];

// Fetch current workflow
const r = await fetch(`${BASE}/${WF_ID}`, {
  headers: { "X-N8N-API-KEY": API_KEY }
});
const wf = await r.json();

function getNode(name) {
  return wf.nodes.find(n => n.name === name || n.id === name);
}

// === FIX 1: Update "Validate & Normalize" to accept ghl_agency_token and n8n_folder_id ===
const validate = getNode("Validate & Normalize");
if (validate) {
  validate.parameters.jsCode = `// ══════════════════════════════════════════════════════════════
// PHASE 0: VALIDATE & NORMALIZE
// ══════════════════════════════════════════════════════════════

const input = $input.first().json;

// Map form fields
const b = input.body || input;
const client_name = (b.client_name || '').trim();
const client_slug = (b.client_slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
const owner_name = (b.owner_name || '').trim();
const owner_email = (b.owner_email || '').trim();
const owner_phone = (b.owner_phone || '').trim();
const ghl_token = (b.ghl_token || '').trim();
const ghl_agency_token = (b.ghl_agency_token || '').trim();
const ghl_location_id = (b.ghl_location_id || '').trim();
const clickup_team_id = (b.clickup_team_id || '').trim();
const clickup_token = (b.clickup_token || '').trim();
const headcount = parseInt(b.headcount) || 2;
const margin_target = parseInt(b.margin_target) || 40;
const labor_cap_pct = parseInt(b.labor_cap_pct) || 15;
const slack_webhook = (b.slack_webhook || '').trim();
const n8n_folder_id = (b.n8n_folder_id || '').trim();
const preflight_only = b.preflight_only === true || b.preflight_only === 'true';

let crew_names = {};
try { crew_names = JSON.parse(b.crew_names_json || '{}'); } catch(e) { crew_names = {'Crew A': 'Lead 1'}; }

// Validate required fields
const errors = [];
if (!client_name) errors.push('Client Name is required');
if (!client_slug) errors.push('Client Slug is required');
if (!owner_email) errors.push('Owner Email is required');
if (!ghl_token) errors.push('GHL Location Token is required');
if (!clickup_team_id) errors.push('ClickUp Team ID is required');
if (!clickup_token) errors.push('ClickUp API Token is required');

const deployment_id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);

return [{
  json: {
    valid: errors.length === 0,
    errors,
    deployment_id,
    client: { name: client_name, slug: client_slug, owner_name, owner_email, owner_phone },
    ghl: { token: ghl_token, agency_token: ghl_agency_token, location_id: ghl_location_id },
    clickup: { team_id: clickup_team_id, token: clickup_token },
    config: { headcount, margin_target, labor_cap_pct, crew_names, slack_webhook, n8n_folder_id },
    preflight_only,
    resources_created: [],
    phase_errors: []
  }
}];
`;
  console.log("OK: Updated Validate & Normalize");
}

// === FIX 2: Update Pre-Flight Checks to use separate tokens + env GitHub token ===
const preflight = getNode("Pre-Flight Checks");
if (preflight) {
  preflight.parameters.jsCode = `// ══════════════════════════════════════════════════════════════
// PRE-FLIGHT CHECKS
// Read-only API calls to validate all credentials before deploy
// ══════════════════════════════════════════════════════════════

const ctx = $input.first().json;
const checks = [];

// ── 1. GHL Agency Token Check ──
if (ctx.ghl.agency_token) {
  try {
    const ghlResp = await fetch('https://services.leadconnectorhq.com/locations/', {
      headers: { 'Authorization': \`Bearer \${ctx.ghl.agency_token}\`, 'Version': '2021-07-28' }
    });
    if (ghlResp.ok) {
      checks.push({ platform: 'GHL Agency', status: 'PASS', message: 'Agency token valid, API accessible' });
    } else {
      checks.push({ platform: 'GHL Agency', status: 'FAIL', message: \`HTTP \${ghlResp.status} — agency token invalid\` });
    }
  } catch(e) {
    checks.push({ platform: 'GHL Agency', status: 'FAIL', message: \`Connection error: \${e.message}\` });
  }
} else {
  checks.push({ platform: 'GHL Agency', status: 'SKIP', message: 'No agency token provided — using location token only' });
}

// ── 2. GHL Location Token Check ──
if (ctx.ghl.location_id) {
  try {
    const locResp = await fetch(\`https://services.leadconnectorhq.com/locations/\${ctx.ghl.location_id}\`, {
      headers: { 'Authorization': \`Bearer \${ctx.ghl.token}\`, 'Version': '2021-07-28' }
    });
    if (locResp.ok) {
      const locData = await locResp.json();
      checks.push({ platform: 'GHL Client Token', status: 'PASS', message: \`Location token valid for \${ctx.ghl.location_id}\` });
    } else {
      checks.push({ platform: 'GHL Client Token', status: 'FAIL', message: \`HTTP \${locResp.status} — check client PIT token\` });
    }
  } catch(e) {
    checks.push({ platform: 'GHL Client Token', status: 'FAIL', message: e.message });
  }
} else {
  checks.push({ platform: 'GHL Client Token', status: 'SKIP', message: 'No location ID — will attempt auto-create' });
}

// ── 3. ClickUp Token + Team Check ──
try {
  const cuResp = await fetch(\`https://api.clickup.com/api/v2/team/\${ctx.clickup.team_id}\`, {
    headers: { 'Authorization': ctx.clickup.token }
  });
  if (cuResp.ok) {
    const cuData = await cuResp.json();
    checks.push({ platform: 'ClickUp', status: 'PASS', message: \`Team: \${cuData.team?.name || ctx.clickup.team_id}\` });
  } else {
    checks.push({ platform: 'ClickUp', status: 'FAIL', message: \`HTTP \${cuResp.status} — check token and team ID\` });
  }
} catch(e) {
  checks.push({ platform: 'ClickUp', status: 'FAIL', message: e.message });
}

// ── 4. GitHub Token Check (from n8n env) ──
const ghToken = $env.GITHUB_TOKEN || '';
if (ghToken) {
  try {
    const ghResp = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': \`token \${ghToken}\`, 'Accept': 'application/vnd.github+json' }
    });
    if (ghResp.ok) {
      const ghData = await ghResp.json();
      checks.push({ platform: 'GitHub', status: 'PASS', message: \`User: \${ghData.login}\` });
    } else {
      checks.push({ platform: 'GitHub', status: 'FAIL', message: \`HTTP \${ghResp.status}\` });
    }
  } catch(e) {
    checks.push({ platform: 'GitHub', status: 'FAIL', message: e.message });
  }
} else {
  checks.push({ platform: 'GitHub', status: 'FAIL', message: 'GITHUB_TOKEN not set in n8n environment' });
}

// ── 5. GitHub Templates Repo Check ──
if (ghToken) {
  try {
    const tplResp = await fetch('https://api.github.com/repos/scubarichard/rpe-workflow-templates/contents/', {
      headers: { 'Authorization': \`token \${ghToken}\` }
    });
    if (tplResp.ok) {
      const files = await tplResp.json();
      const jsonFiles = files.filter(f => f.name.endsWith('.json'));
      checks.push({ platform: 'Templates Repo', status: 'PASS', message: \`\${jsonFiles.length} workflow templates found\` });
    } else {
      checks.push({ platform: 'Templates Repo', status: 'FAIL', message: 'rpe-workflow-templates repo not accessible' });
    }
  } catch(e) {
    checks.push({ platform: 'Templates Repo', status: 'FAIL', message: e.message });
  }
} else {
  checks.push({ platform: 'Templates Repo', status: 'SKIP', message: 'Skipped — no GitHub token' });
}

// ── 6. n8n API Check ──
const n8nKey = $env.N8N_API_KEY || '';
if (n8nKey) {
  try {
    const n8nResp = await fetch('https://n8n.dakona.net/api/v1/workflows?limit=1', {
      headers: { 'X-N8N-API-KEY': n8nKey }
    });
    checks.push({ platform: 'n8n API', status: n8nResp.ok ? 'PASS' : 'FAIL', message: n8nResp.ok ? 'API accessible' : \`HTTP \${n8nResp.status}\` });
  } catch(e) {
    checks.push({ platform: 'n8n API', status: 'FAIL', message: e.message });
  }
} else {
  checks.push({ platform: 'n8n API', status: 'FAIL', message: 'N8N_API_KEY not set in n8n environment' });
}

// ── 7. n8n Folder Check ──
if (ctx.config.n8n_folder_id) {
  checks.push({ platform: 'n8n Folder', status: 'PASS', message: \`Folder ID: \${ctx.config.n8n_folder_id}\` });
} else {
  checks.push({ platform: 'n8n Folder', status: 'SKIP', message: 'No folder ID — workflows will be created in root' });
}

// ── 8. Slack Webhook Check (optional) ──
if (ctx.config.slack_webhook) {
  try {
    const slackResp = await fetch(ctx.config.slack_webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: \`Pre-flight check for \${ctx.client.name} deployment\` })
    });
    checks.push({ platform: 'Slack', status: slackResp.ok ? 'PASS' : 'FAIL', message: slackResp.ok ? 'Webhook valid, test message sent' : \`HTTP \${slackResp.status}\` });
  } catch(e) {
    checks.push({ platform: 'Slack', status: 'FAIL', message: e.message });
  }
} else {
  checks.push({ platform: 'Slack', status: 'SKIP', message: 'No webhook URL provided' });
}

// ── 9. Crew Names JSON Check ──
try {
  const crews = ctx.config.crew_names;
  const count = Object.keys(crews).length;
  checks.push({ platform: 'Config', status: count > 0 ? 'PASS' : 'FAIL', message: \`\${count} crew(s) defined: \${Object.values(crews).join(', ')}\` });
} catch(e) {
  checks.push({ platform: 'Config', status: 'FAIL', message: 'Invalid crew names JSON' });
}

const passed = checks.filter(c => c.status === 'PASS').length;
const failed = checks.filter(c => c.status === 'FAIL').length;
const skipped = checks.filter(c => c.status === 'SKIP').length;

return [{
  json: {
    ...ctx,
    preflight: {
      checks,
      summary: { passed, failed, skipped, total: checks.length },
      all_passed: failed === 0
    }
  }
}];
`;
  console.log("OK: Updated Pre-Flight Checks");
}

// === FIX 3: Update Phase 2A to pull tokens from env ===
const phase2a = getNode("Phase 2A: Build ID Map");
if (phase2a) {
  // Replace hardcoded tokens with env refs
  let code = phase2a.parameters.jsCode;
  // Replace n8n api key
  code = code.replace(
    /'\{\{n8n_api_key\}\}':\s*'[^']*'/,
    "'{{n8n_api_key}}': $env.N8N_API_KEY || ''"
  );
  // Replace github token
  code = code.replace(
    /'\{\{github_token\}\}':\s*'[^']*'/,
    "'{{github_token}}': $env.GITHUB_TOKEN || ''"
  );
  phase2a.parameters.jsCode = code;
  console.log("OK: Updated Phase 2A — tokens from env");
}

// === FIX 4: Update Phase 2B to use env github token ===
const phase2b = getNode("Phase 2B: Create Workflows");
if (phase2b) {
  let code = phase2b.parameters.jsCode;
  // The n8n API key reference comes from placeholders, which now uses env
  // No hardcoded tokens to fix here since it reads from placeholders
  console.log("OK: Phase 2B uses placeholders (now env-backed)");
}

// === FIX 5: Update Phase 4B to use env github token ===
const phase4b = getNode("Phase 4B: Save to GitHub");
if (phase4b) {
  let code = phase4b.parameters.jsCode;
  code = code.replace(
    /const GH_TOKEN = '[^']*'/,
    "const GH_TOKEN = $env.GITHUB_TOKEN || ''"
  );
  phase4b.parameters.jsCode = code;
  console.log("OK: Updated Phase 4B — GitHub token from env");
}

// === FIX 6: Update Phase 3 to use env github token ===
const phase3 = getNode("Phase 3: Dashboard Deploy");
if (phase3) {
  let code = phase3.parameters.jsCode;
  code = code.replace(
    /const ghToken = p\['\{\{github_token\}\}'\]/,
    "const ghToken = $env.GITHUB_TOKEN || p['{{github_token}}']"
  );
  phase3.parameters.jsCode = code;
  console.log("OK: Updated Phase 3 — GitHub token from env with fallback");
}

// Build clean payload
const body = {};
for (const k of ALLOW) if (wf[k] !== undefined) body[k] = wf[k];

// PUT it back
const putResp = await fetch(`${BASE}/${WF_ID}`, {
  method: "PUT",
  headers: { "X-N8N-API-KEY": API_KEY, "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

if (putResp.ok) {
  const result = await putResp.json();
  console.log(`\nDone: ${result.name} updated, active=${result.active}`);
} else {
  const err = await putResp.text();
  console.log("PUT failed:", putResp.status, err.slice(0, 300));
}
