/**
 * Patch DAX Router workflow to use per-advisor email from LibreChat SSO
 * Replaces all hardcoded rmabbun@dakona.com with dynamic advisorEmail variable
 */

const https = require('https');

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIn0.hBFmobT3MXRwMR-5lGOIjKf8JzCnrwCinCJ-x-E8O0g';
const WORKFLOW_ID = '3tniyxZREqfnAbfo';
const N8N_HOST = 'n8n.dakona.net';

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: N8N_HOST,
      path: `/api/v1${path}`,
      method,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve({ _raw: data, _status: res.statusCode }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// New Extract Message node code — reads advisorEmail from body.user (LibreChat SSO)
const NEW_EXTRACT_CODE = `var body = $json.body || $json;
var rawMessages = body.messages || [];
var messages = [];

for (var i = 0; i < rawMessages.length; i++) {
  var m = rawMessages[i];
  if (!m || typeof m !== "object") continue;
  var role = String(m.role || "").trim();
  if (!role) continue;

  if (Array.isArray(m.content)) {
    var hasContent = false;
    for (var c = 0; c < m.content.length; c++) {
      var part = m.content[c];
      if (part.type === "text" && part.text) hasContent = true;
      if (part.type === "image_url") hasContent = true;
      if (part.type === "image") hasContent = true;
    }
    if (hasContent) messages.push({ role: role, content: m.content });
  } else if (typeof m.content === "string" && m.content.trim()) {
    messages.push({ role: role, content: m.content });
  }
}

var userText = "";
for (var j = messages.length - 1; j >= 0; j--) {
  if (messages[j].role === "user") {
    if (typeof messages[j].content === "string") {
      userText = messages[j].content;
    } else if (Array.isArray(messages[j].content)) {
      var parts = [];
      for (var k = 0; k < messages[j].content.length; k++) {
        if (messages[j].content[k].type === "text") parts.push(messages[j].content[k].text || "");
      }
      userText = parts.join(" ");
      if (!userText) userText = "[Image uploaded]";
    }
    break;
  }
}

var lcText = userText.toLowerCase();
var isTitle = lcText.indexOf("title for the conversation") >= 0 || lcText.indexOf("concise title") >= 0 || lcText.indexOf("5-word") >= 0;

if (messages.length === 0) {
  messages.push({ role: "user", content: userText || "Hello" });
}

var hasImage = false;
for (var x = 0; x < messages.length; x++) {
  if (Array.isArray(messages[x].content)) {
    for (var y = 0; y < messages[x].content.length; y++) {
      if (messages[x].content[y].type === "image_url" || messages[x].content[y].type === "image") hasImage = true;
    }
  }
}

// ADVISOR EMAIL — read from LibreChat SSO (body.user = logged-in user's email)
// LibreChat passes the authenticated user's identifier in body.user when not in dropParams
var advisorEmail = body.user || process.env.ADVISOR_EMAIL || 'rmabbun@dakona.com';
// Validate it looks like an email (not a UUID)
if (!advisorEmail || advisorEmail.indexOf('@') < 0) {
  advisorEmail = process.env.ADVISOR_EMAIL || 'rmabbun@dakona.com';
}

// ADVISOR TIMEZONE — read from Exchange mailbox settings for this advisor
var advisorTimezone = process.env.ADVISOR_TIMEZONE || 'America/New_York';
var currentDateTime = '';
var currentTime = '';

try {
  var tenantId = process.env.GRAPH_TENANT_ID;
  var clientId = process.env.GRAPH_CLIENT_ID;
  var clientSecret = process.env.GRAPH_CLIENT_SECRET;

  if (tenantId && clientId && clientSecret) {
    var tokenUrl = 'https://login.microsoftonline.com/' + tenantId + '/oauth2/v2.0/token';
    var tokenBody = 'grant_type=client_credentials&client_id=' + clientId + '&client_secret=' + encodeURIComponent(clientSecret) + '&scope=https%3A%2F%2Fgraph.microsoft.com%2F.default';

    var tokenResp = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody
    });
    var tokenData = await tokenResp.json();

    if (tokenData.access_token) {
      var mbResp = await fetch('https://graph.microsoft.com/v1.0/users/' + advisorEmail + '/mailboxSettings', {
        headers: { 'Authorization': 'Bearer ' + tokenData.access_token }
      });
      if (mbResp.ok) {
        var mbData = await mbResp.json();
        if (mbData.timeZone) {
          var winToIana = {
            'Eastern Standard Time': 'America/New_York',
            'Eastern Daylight Time': 'America/New_York',
            'Central Standard Time': 'America/Chicago',
            'Central Daylight Time': 'America/Chicago',
            'Mountain Standard Time': 'America/Denver',
            'Mountain Daylight Time': 'America/Denver',
            'Pacific Standard Time': 'America/Los_Angeles',
            'Pacific Daylight Time': 'America/Los_Angeles',
            'Alaska Standard Time': 'America/Anchorage',
            'Hawaiian Standard Time': 'Pacific/Honolulu',
            'Arizona': 'America/Phoenix',
            'UTC': 'UTC'
          };
          advisorTimezone = winToIana[mbData.timeZone] || mbData.timeZone;
        }
      }
    }
  }
} catch(e) {
  // Fall back to env var or default
}

try {
  var now = new Date();
  currentDateTime = now.toLocaleString('en-US', {
    timeZone: advisorTimezone,
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  });
  currentTime = now.toLocaleTimeString('en-US', {
    timeZone: advisorTimezone,
    hour: 'numeric', minute: '2-digit', hour12: true
  });
} catch(e) {
  currentDateTime = new Date().toISOString();
  currentTime = new Date().toISOString();
}

var useProxy = isTitle || hasImage;
return [{ json: {
  userText: userText,
  isTitle: isTitle,
  hasImage: hasImage,
  useProxy: useProxy,
  originalMessages: messages,
  originalBody: body,
  advisorEmail: advisorEmail,
  advisorTimezone: advisorTimezone,
  currentDateTime: currentDateTime,
  currentTime: currentTime
} }];`;

async function main() {
  console.log('Fetching workflow...');
  const wf = await apiRequest('GET', `/workflows/${WORKFLOW_ID}`);
  
  if (!wf.nodes || !Array.isArray(wf.nodes)) {
    console.error('No nodes found in workflow. Response keys:', Object.keys(wf));
    if (wf._raw) console.log('Raw (first 500):', wf._raw.substring(0, 500));
    return;
  }

  console.log(`Found ${wf.nodes.length} nodes`);
  let patchCount = 0;
  let emailPatchCount = 0;

  wf.nodes = wf.nodes.map(node => {
    // 1. Patch Extract Message node with new code that reads advisorEmail from body.user
    if (node.id === 'extract-msg-001') {
      console.log('  Patching Extract Message node...');
      node.parameters.jsCode = NEW_EXTRACT_CODE;
      patchCount++;
    }

    // 2. Patch ALL tool nodes — replace hardcoded email with advisorEmail variable
    // These nodes read advisorEmail from $input context
    if (node.parameters && node.parameters.jsCode) {
      const before = node.parameters.jsCode;
      
      // Replace hardcoded email in all tool nodes
      // Pattern: any string literal containing rmabbun@dakona.com that's used as a mailbox address
      const patched = node.parameters.jsCode
        // Email tool, Calendar tool, Send Email, Manage Calendar, Meeting Prep
        .replace(/\/v1\.0\/users\/rmabbun@dakona\.com\//g, '/v1.0/users/' + "' + (input.advisorEmail || process.env.ADVISOR_EMAIL || 'rmabbun@dakona.com') + '/")
        // Audit log advisor name - keep as Demo Advisor for now
        ;
      
      if (patched !== before) {
        node.parameters.jsCode = patched;
        emailPatchCount++;
        console.log(`  Patched email in node: ${node.name} (${node.id})`);
      }
    }

    return node;
  });

  console.log(`\nPatched ${patchCount} nodes, fixed email in ${emailPatchCount} tool nodes`);
  
  // Remove fields that cause update failures
  delete wf.updatedAt;
  delete wf.createdAt;
  delete wf.versionId;
  delete wf.activeVersionId;
  delete wf.versionCounter;
  delete wf.triggerCount;
  delete wf.shared;
  delete wf.tags;
  delete wf.activeVersion;
  delete wf.workflowPublishHistory;
  delete wf._raw;

  console.log('\nUpdating workflow...');
  const result = await apiRequest('PUT', `/workflows/${WORKFLOW_ID}`, wf);
  
  if (result.id) {
    console.log(`✅ Workflow updated successfully! ID: ${result.id}`);
  } else {
    console.error('❌ Update failed:', JSON.stringify(result).substring(0, 500));
  }
}

main().catch(console.error);
