import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(__dirname, "kv-seed.json"), "utf-8"));
const KEY = seed["n8n-api-key"];
const CLIENT_ID = seed["ghl-oauth-client-id"];
const CLIENT_SECRET = seed["ghl-oauth-client-secret"];
const BASE = "https://n8n.dakona.net/api/v1";

const wf = {
  name: "[RPE] OAuth Callback",
  nodes: [
    {
      parameters: {
        httpMethod: "GET",
        path: "oauth-callback",
        responseMode: "lastNode",
        options: {}
      },
      name: "Webhook",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [250, 300],
      webhookId: "oauth-callback"
    },
    {
      parameters: {
        jsCode: `const https = require('https');
const urlMod = require('url');

function httpPost(rawUrl, headers, bodyStr) {
  return new Promise((resolve, reject) => {
    const parsed = urlMod.parse(rawUrl);
    const opts = {
      hostname: parsed.hostname, path: parsed.path, method: 'POST',
      headers: Object.assign({}, headers, {'Content-Length': Buffer.byteLength(bodyStr)})
    };
    const req = https.request(opts, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(b); } catch {}
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: json, text: b });
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

const code = $input.first().json.query.code;
if (!code) return [{ json: { error: 'No authorization code received' } }];

const params = [
  'client_id=${CLIENT_ID}',
  'client_secret=${CLIENT_SECRET}',
  'grant_type=authorization_code',
  'code=' + encodeURIComponent(code),
  'redirect_uri=' + encodeURIComponent('https://n8n.dakona.net/webhook/oauth-callback')
].join('&');

const r = await httpPost('https://services.leadconnectorhq.com/oauth/token', {
  'Content-Type': 'application/x-www-form-urlencoded'
}, params);

if (r.ok && r.json) {
  return [{ json: {
    success: true,
    message: 'OAuth tokens obtained! Save these.',
    access_token: r.json.access_token,
    refresh_token: r.json.refresh_token,
    token_type: r.json.token_type,
    expires_in: r.json.expires_in,
    scope: r.json.scope,
    locationId: r.json.locationId,
    companyId: r.json.companyId,
    obtained_at: new Date().toISOString()
  } }];
} else {
  return [{ json: { success: false, error: r.text, status: r.status } }];
}`
      },
      name: "Exchange Code",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [500, 300]
    },
    {
      parameters: {
        respondWith: "json",
        responseBody: "={{JSON.stringify($json, null, 2)}}",
        options: {}
      },
      name: "Respond",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.1,
      position: [750, 300]
    }
  ],
  connections: {
    "Webhook": { main: [[{ node: "Exchange Code", type: "main", index: 0 }]] },
    "Exchange Code": { main: [[{ node: "Respond", type: "main", index: 0 }]] }
  },
  settings: {}
};

const cr = await fetch(`${BASE}/workflows`, {
  method: "POST",
  headers: { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" },
  body: JSON.stringify(wf)
});
const created = await cr.json();
console.log("Created:", created.id, created.name);

const ar = await fetch(`${BASE}/workflows/${created.id}/activate`, {
  method: "POST",
  headers: { "X-N8N-API-KEY": KEY }
});
console.log("Activated:", (await ar.json()).active);
