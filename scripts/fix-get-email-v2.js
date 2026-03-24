/**
 * Clean rewrite of get_email tool with date ranges + name search.
 * Run: node scripts/fix-get-email-v2.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '3tniyxZREqfnAbfo';

const EMAIL_CODE = `var https = require("https");
var input = $input.all()[0].json || {};
var userText = (input.userText || input.query || "").toLowerCase();

function graphGet(path, token) {
  return new Promise(function(resolve) {
    https.get({ hostname: "graph.microsoft.com", path: path.split(" ").join("%20"), headers: { "Authorization": "Bearer " + token } }, function(res) {
      var d = ""; res.on("data", function(c) { d += c; });
      res.on("end", function() { try { resolve(JSON.parse(d)); } catch(e) { resolve({ error: "parse error" }); } });
    }).on("error", function() { resolve({ error: "connection error" }); });
  });
}

// Get token
var tokenBody = "client_id=218064ac-bee2-4246-9709-ae7518ae71cb&client_secret=6LR8Q~ZCn5FTBlg894LtCGlXZ9GV3NAhS4BY9bla&scope=https://graph.microsoft.com/.default&grant_type=client_credentials";
var tokenRes = await new Promise(function(resolve) {
  var req = https.request({ hostname: "login.microsoftonline.com", path: "/d2a3c346-00f3-47dd-a53e-caa3fca74714/oauth2/v2.0/token", method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(tokenBody) } }, function(res) {
    var d = ""; res.on("data", function(c) { d += c; }); res.on("end", function() { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
  });
  req.on("error", function() { resolve({}); });
  req.write(tokenBody); req.end();
});
var token = tokenRes.access_token || "";
if (!token) return "Could not connect to email.";

// Detect sender name
var senderName = "";
var fromMatch = userText.match(/from\\s+([a-z]+)/i);
if (fromMatch) senderName = fromMatch[1];

// Detect date range (days back)
var days = 0;
if (userText.indexOf("2 week") >= 0 || userText.indexOf("two week") >= 0) days = 14;
else if (userText.indexOf("last week") >= 0 || userText.indexOf("this week") >= 0) days = 7;
else if (userText.indexOf("month") >= 0) days = 30;
else if (userText.indexOf("today") >= 0) days = 1;
else if (userText.indexOf("yesterday") >= 0) days = 2;
else if (userText.indexOf("3 day") >= 0) days = 3;

// Detect unread
var unreadOnly = userText.indexOf("unread") >= 0 || userText.indexOf("new email") >= 0 || userText.indexOf("new mail") >= 0;

// Build path — two approaches depending on whether we need search
var base = "/v1.0/users/richard@dakona.com/mailFolders/inbox/messages";
var params = "$top=25&$select=subject,from,receivedDateTime,isRead,bodyPreview&$orderby=receivedDateTime%20desc";

if (senderName) {
  // Use $search for name-based filtering (can't combine with $filter)
  params += "&$search=%22from:" + senderName + "%22";
}

if (!senderName) {
  // Can use $filter when not using $search
  var filters = [];
  if (unreadOnly) filters.push("isRead%20eq%20false");
  if (days > 0) {
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    filters.push("receivedDateTime%20ge%20" + cutoff.toISOString().split(".")[0] + "Z");
  }
  if (filters.length > 0) params += "&$filter=" + filters.join("%20and%20");
}

var mailData = await graphGet(base + "?" + params, token);
var messages = mailData.value || [];

// Client-side date filter if using search (search ignores date)
if (senderName && days > 0) {
  var cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  messages = messages.filter(function(m) { return new Date(m.receivedDateTime) >= cutoffDate; });
}

// Client-side unread filter if using search
if (senderName && unreadOnly) {
  messages = messages.filter(function(m) { return !m.isRead; });
}

if (messages.length === 0) return "No emails found matching your criteria.";

var lines = messages.map(function(m, i) {
  var fromName = (m.from && m.from.emailAddress) ? (m.from.emailAddress.name || m.from.emailAddress.address) : "Unknown";
  var fromAddr = (m.from && m.from.emailAddress) ? m.from.emailAddress.address : "";
  var date = new Date(m.receivedDateTime).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "short", timeStyle: "short" });
  var status = m.isRead ? "Read" : "Unread";
  var preview = (m.bodyPreview || "").substring(0, 80);
  return (i + 1) + ". " + m.subject + "\\n   From: " + fromName + " <" + fromAddr + ">\\n   " + date + " | " + status + "\\n   " + preview;
});

return "Found " + messages.length + " email" + (messages.length !== 1 ? "s" : "") + ":\\n\\n" + lines.join("\\n\\n");`;

async function deploy() {
  console.log('Fetching...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();
  const tool = wf.nodes.find(n => n.name === 'Email Tool');
  tool.parameters.jsCode = EMAIL_CODE;
  console.log('  Deployed clean email tool v2');

  const r = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings })
  });
  const result = await r.json();
  if (!result.id) { console.error('FAILED:', JSON.stringify(result).substring(0, 500)); process.exit(1); }
  await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}/activate`, {
    method: 'POST', headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  console.log('  Activated');
}

deploy().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
