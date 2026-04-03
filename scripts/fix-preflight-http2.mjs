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

const pf = wf.nodes.find(n => n.name === "Pre-Flight Checks");
if (pf) {
  pf.parameters.jsCode = `// ══════════════════════════════════════════════════════════════
// PRE-FLIGHT CHECKS — native https, no URL/fetch dependency
// ══════════════════════════════════════════════════════════════

const https = require('https');
const url = require('url');
const ctx = $input.first().json;
const checks = [];

function httpGet(rawUrl, headers) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(rawUrl);
    const opts = { hostname: parsed.hostname, path: parsed.path, method: 'GET', headers: headers || {} };
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch(e) {}
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json, text: body });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── 1. GHL Agency Token ──
if (ctx.ghl.agency_token) {
  try {
    const r = await httpGet('https://services.leadconnectorhq.com/locations/', {
      'Authorization': 'Bearer ' + ctx.ghl.agency_token, 'Version': '2021-07-28'
    });
    checks.push({ platform: 'GHL Agency', status: r.ok ? 'PASS' : 'FAIL',
      message: r.ok ? 'Agency token valid' : 'HTTP ' + r.status + ' — agency token invalid' });
  } catch(e) {
    checks.push({ platform: 'GHL Agency', status: 'FAIL', message: 'Connection error: ' + e.message });
  }
} else {
  checks.push({ platform: 'GHL Agency', status: 'SKIP', message: 'No agency token provided' });
}

// ── 2. GHL Client Token ──
if (ctx.ghl.location_id) {
  try {
    const r = await httpGet('https://services.leadconnectorhq.com/locations/' + ctx.ghl.location_id, {
      'Authorization': 'Bearer ' + ctx.ghl.token, 'Version': '2021-07-28'
    });
    checks.push({ platform: 'GHL Client Token', status: r.ok ? 'PASS' : 'FAIL',
      message: r.ok ? 'Location token valid for ' + ctx.ghl.location_id : 'HTTP ' + r.status + ' — check client PIT token' });
  } catch(e) {
    checks.push({ platform: 'GHL Client Token', status: 'FAIL', message: e.message });
  }
} else {
  checks.push({ platform: 'GHL Client Token', status: 'SKIP', message: 'No location ID — will attempt auto-create' });
}

// ── 3. ClickUp ──
try {
  const r = await httpGet('https://api.clickup.com/api/v2/team/' + ctx.clickup.team_id, {
    'Authorization': ctx.clickup.token
  });
  checks.push({ platform: 'ClickUp', status: r.ok ? 'PASS' : 'FAIL',
    message: r.ok ? 'Team: ' + ((r.json && r.json.team && r.json.team.name) || ctx.clickup.team_id) : 'HTTP ' + r.status });
} catch(e) {
  checks.push({ platform: 'ClickUp', status: 'FAIL', message: e.message });
}

// ── 4. GitHub ──
const ghToken = (ctx.config && ctx.config.github_token) || '';
if (ghToken) {
  try {
    const r = await httpGet('https://api.github.com/user', {
      'Authorization': 'token ' + ghToken, 'Accept': 'application/vnd.github+json', 'User-Agent': 'n8n-rpe'
    });
    checks.push({ platform: 'GitHub', status: r.ok ? 'PASS' : 'FAIL',
      message: r.ok ? 'User: ' + ((r.json && r.json.login) || 'ok') : 'HTTP ' + r.status });
  } catch(e) {
    checks.push({ platform: 'GitHub', status: 'FAIL', message: e.message });
  }
} else {
  checks.push({ platform: 'GitHub', status: 'FAIL', message: 'No github_token in payload' });
}

// ── 5. Templates Repo ──
if (ghToken) {
  try {
    const r = await httpGet('https://api.github.com/repos/scubarichard/rpe-workflow-templates/contents/', {
      'Authorization': 'token ' + ghToken, 'User-Agent': 'n8n-rpe'
    });
    if (r.ok && Array.isArray(r.json)) {
      const files = r.json.filter(function(f) { return f.name && f.name.endsWith('.json'); });
      checks.push({ platform: 'Templates Repo', status: 'PASS', message: files.length + ' workflow templates found' });
    } else {
      checks.push({ platform: 'Templates Repo', status: 'FAIL', message: 'Repo not accessible (HTTP ' + r.status + ')' });
    }
  } catch(e) {
    checks.push({ platform: 'Templates Repo', status: 'FAIL', message: e.message });
  }
} else {
  checks.push({ platform: 'Templates Repo', status: 'SKIP', message: 'Skipped — no GitHub token' });
}

// ── 6. n8n API ──
const n8nKey = (ctx.config && ctx.config.n8n_api_key) || '';
if (n8nKey) {
  try {
    const r = await httpGet('https://n8n.dakona.net/api/v1/workflows?limit=1', {
      'X-N8N-API-KEY': n8nKey
    });
    checks.push({ platform: 'n8n API', status: r.ok ? 'PASS' : 'FAIL',
      message: r.ok ? 'API accessible' : 'HTTP ' + r.status });
  } catch(e) {
    checks.push({ platform: 'n8n API', status: 'FAIL', message: e.message });
  }
} else {
  checks.push({ platform: 'n8n API', status: 'FAIL', message: 'No n8n_api_key in payload' });
}

// ── 7. n8n Folder ──
if (ctx.config.n8n_folder_id) {
  checks.push({ platform: 'n8n Folder', status: 'PASS', message: 'Folder ID: ' + ctx.config.n8n_folder_id });
} else {
  checks.push({ platform: 'n8n Folder', status: 'SKIP', message: 'No folder ID — workflows will be created in root' });
}

// ── 8. Slack ──
if (ctx.config.slack_webhook) {
  checks.push({ platform: 'Slack', status: 'SKIP', message: 'Webhook provided — not tested in pre-flight' });
} else {
  checks.push({ platform: 'Slack', status: 'SKIP', message: 'No webhook URL provided' });
}

// ── 9. Config ──
try {
  const crews = ctx.config.crew_names;
  const count = Object.keys(crews).length;
  checks.push({ platform: 'Config', status: count > 0 ? 'PASS' : 'FAIL',
    message: count + ' crew(s) defined: ' + Object.values(crews).join(', ') });
} catch(e) {
  checks.push({ platform: 'Config', status: 'FAIL', message: 'Invalid crew names JSON' });
}

const passed = checks.filter(function(c) { return c.status === 'PASS'; }).length;
const failed = checks.filter(function(c) { return c.status === 'FAIL'; }).length;
const skipped = checks.filter(function(c) { return c.status === 'SKIP'; }).length;

return [{
  json: {
    ...ctx,
    preflight: {
      checks: checks,
      summary: { passed: passed, failed: failed, skipped: skipped, total: checks.length },
      all_passed: failed === 0
    }
  }
}];
`;
  console.log("OK: Rewrote Pre-Flight with url.parse instead of new URL");
}

const body = {};
for (const k of ALLOW) if (wf[k] !== undefined) body[k] = wf[k];
const p = await fetch(`${BASE}/${WF_ID}`, {
  method: "PUT",
  headers: {"X-N8N-API-KEY":KEY,"Content-Type":"application/json"},
  body: JSON.stringify(body)
});
console.log("PUT:", p.ok ? "OK" : p.status);
