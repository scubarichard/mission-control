/**
 * Fix get_email — date ranges, name-based sender search, 25 default results.
 * Run: node scripts/fix-get-email.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '3tniyxZREqfnAbfo';
const GRAPH_TENANT = 'd2a3c346-00f3-47dd-a53e-caa3fca74714';
const GRAPH_CLIENT_ID = '218064ac-bee2-4246-9709-ae7518ae71cb';
const GRAPH_CLIENT_SECRET = '6LR8Q~ZCn5FTBlg894LtCGlXZ9GV3NAhS4BY9bla';

const EMAIL_CODE = `var https = require("https");
// v2 — clean rewrite with proper date range + name search
var input = $input.all()[0].json || {};
var userText = (input.userText || input.query || "").toLowerCase();

// Get Graph token
var tokenBody = "client_id=${GRAPH_CLIENT_ID}&client_secret=${GRAPH_CLIENT_SECRET}&scope=https://graph.microsoft.com/.default&grant_type=client_credentials";
var tokenRes = await new Promise(function(resolve) {
  var req = https.request({ hostname: "login.microsoftonline.com", path: "/${GRAPH_TENANT}/oauth2/v2.0/token", method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(tokenBody) } }, function(res) {
    var d = ""; res.on("data", function(c) { d += c; }); res.on("end", function() { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
  });
  req.on("error", function() { resolve({}); });
  req.write(tokenBody); req.end();
});
var token = tokenRes.access_token || "";
if (!token) return "Could not connect to email. Please try again.";

// Parse request from user text
var maxResults = 25;
var filterParts = [];
var searchTerm = "";

// Date range detection
var days = 0;
if (userText.indexOf("2 week") >= 0 || userText.indexOf("two week") >= 0) days = 14;
else if (userText.indexOf("last week") >= 0 || userText.indexOf("this week") >= 0 || userText.indexOf("past week") >= 0) days = 7;
else if (userText.indexOf("last month") >= 0 || userText.indexOf("past month") >= 0 || userText.indexOf("this month") >= 0) days = 30;
else if (userText.indexOf("3 day") >= 0 || userText.indexOf("three day") >= 0) days = 3;
else if (userText.indexOf("today") >= 0) days = 1;
else if (userText.indexOf("yesterday") >= 0) days = 2;

if (days > 0) {
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  filterParts.push("receivedDateTime ge " + cutoff.toISOString());
}

// Unread filter
if (userText.indexOf("unread") >= 0 || userText.indexOf("new") >= 0) {
  filterParts.push("isRead eq false");
}

// Sender detection — extract name after "from"
var fromMatch = userText.match(/from\\s+([a-z]+(?:\\s+[a-z]+)?)/i);
if (fromMatch) {
  searchTerm = fromMatch[1].trim();
}

// Build URL
var path = "/v1.0/users/richard@dakona.com/mailFolders/inbox/messages?$top=" + maxResults + "&$select=subject,from,receivedDateTime,isRead,bodyPreview&$orderby=receivedDateTime%20desc";

if (searchTerm) {
  path += "&$search=%22from:" + encodeURIComponent(searchTerm) + "%22";
  // Note: $search and $filter can't be combined in Graph API
  // If we have a search term, use search only (it covers date range implicitly)
  if (days > 0) {
    // Apply date filter client-side after results
  }
} else if (filterParts.length > 0) {
  path += "&$filter=" + encodeURIComponent(filterParts.join(" and "));
}

var mailData = await new Promise(function(resolve) {
  https.get({ hostname: "graph.microsoft.com", path: path.split(" ").join("%20"), headers: { "Authorization": "Bearer " + token } }, function(res) {
    var d = ""; res.on("data", function(c) { d += c; }); res.on("end", function() { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
  }).on("error", function() { resolve({}); });
});

var messages = mailData.value || [];

// Client-side date filter if search was used with date range
if (searchTerm && days > 0) {
  var cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  messages = messages.filter(function(m) {
    return new Date(m.receivedDateTime) >= cutoffDate;
  });
}

if (messages.length === 0) return "No emails found matching your criteria.";

var lines = messages.map(function(m, i) {
  var fromName = (m.from && m.from.emailAddress) ? m.from.emailAddress.name || m.from.emailAddress.address : "Unknown";
  var fromAddr = (m.from && m.from.emailAddress) ? m.from.emailAddress.address : "";
  var date = new Date(m.receivedDateTime).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "short", timeStyle: "short" });
  var status = m.isRead ? "Read" : "Unread";
  var preview = (m.bodyPreview || "").substring(0, 100);
  return (i + 1) + ". " + m.subject + "\\n   From: " + fromName + " <" + fromAddr + ">\\n   " + date + " | " + status + "\\n   " + preview;
});

return "Found " + messages.length + " email" + (messages.length !== 1 ? "s" : "") + ":\\n\\n" + lines.join("\\n\\n");`;

async function deploy() {
  console.log('Fetching...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();

  const emailTool = wf.nodes.find(n => n.name === 'Email Tool');
  emailTool.parameters.jsCode = EMAIL_CODE;
  emailTool.parameters.description = 'Checks the advisor\'s Exchange email inbox. Use when asked about emails from a specific person, unread messages, emails from a time period (last 2 weeks, this month, etc.), or emails about a subject. For sender searches, extracts the name from natural language. Returns up to 25 results with subject, sender, date, status, and preview.';
  console.log('  Updated get_email: date ranges, name search, 25 results');

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
