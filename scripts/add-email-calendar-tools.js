/**
 * Add get_email and get_calendar Code tools to AI Agent.
 * Uses Graph API via VNet (same pattern as title proxy).
 * Run: node scripts/add-email-calendar-tools.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '3tniyxZREqfnAbfo';
const GRAPH_TENANT = 'd2a3c346-00f3-47dd-a53e-caa3fca74714';
const GRAPH_CLIENT_ID = '218064ac-bee2-4246-9709-ae7518ae71cb';
const GRAPH_CLIENT_SECRET = '6LR8Q~ZCn5FTBlg894LtCGlXZ9GV3NAhS4BY9bla';

const EMAIL_CODE = `var https = require("https");
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

// Determine filter from user text
var isUnread = userText.indexOf("unread") >= 0 || userText.indexOf("new") >= 0;
var isToday = userText.indexOf("today") >= 0;
var filterQuery = "";
if (isUnread) filterQuery = "isRead%20eq%20false";
else if (isToday) {
  var today = new Date().toISOString().split("T")[0];
  filterQuery = "receivedDateTime%20ge%20" + today + "T00:00:00Z";
}

var path = "/v1.0/users/richard@dakona.com/mailFolders/inbox/messages?$top=10&$select=subject,from,receivedDateTime,isRead,bodyPreview&$orderby=receivedDateTime%20desc";
if (filterQuery) path += "&$filter=" + filterQuery;

var mailData = await new Promise(function(resolve) {
  https.get({ hostname: "graph.microsoft.com", path: path, headers: { "Authorization": "Bearer " + token } }, function(res) {
    var d = ""; res.on("data", function(c) { d += c; }); res.on("end", function() { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
  }).on("error", function() { resolve({}); });
});

var messages = mailData.value || [];
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

const CALENDAR_CODE = `var https = require("https");
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
if (!token) return "Could not connect to calendar. Please try again.";

// Determine time range
var now = new Date();
var timeMin, timeMax;
if (userText.indexOf("tomorrow") >= 0) {
  var tom = new Date(); tom.setDate(tom.getDate() + 1);
  timeMin = tom.toISOString().split("T")[0] + "T00:00:00Z";
  timeMax = tom.toISOString().split("T")[0] + "T23:59:59Z";
} else if (userText.indexOf("week") >= 0) {
  timeMin = now.toISOString();
  var weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
  timeMax = weekEnd.toISOString();
} else {
  // Default: today
  var todayStr = now.toISOString().split("T")[0];
  timeMin = todayStr + "T00:00:00Z";
  timeMax = todayStr + "T23:59:59Z";
}

var path = "/v1.0/users/richard@dakona.com/events?$top=20&$select=subject,start,end,location,attendees,bodyPreview&$orderby=start/dateTime&$filter=start/dateTime%20ge%20'" + encodeURIComponent(timeMin) + "'%20and%20end/dateTime%20le%20'" + encodeURIComponent(timeMax) + "'";

var calData = await new Promise(function(resolve) {
  https.get({ hostname: "graph.microsoft.com", path: path.split(" ").join("%20"), headers: { "Authorization": "Bearer " + token } }, function(res) {
    var d = ""; res.on("data", function(c) { d += c; }); res.on("end", function() { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
  }).on("error", function() { resolve({}); });
});

var events = calData.value || [];
var period = userText.indexOf("tomorrow") >= 0 ? "tomorrow" : userText.indexOf("week") >= 0 ? "this week" : "today";
if (events.length === 0) return "No calendar events found for " + period + ".";

var lines = events.map(function(e, i) {
  var startTime = new Date(e.start.dateTime + "Z").toLocaleString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit", hour12: true });
  var endTime = new Date(e.end.dateTime + "Z").toLocaleString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit", hour12: true });
  var loc = (e.location && e.location.displayName) || "No location";
  var attendees = (e.attendees || []).slice(0, 3).map(function(a) { return (a.emailAddress && a.emailAddress.name) || (a.emailAddress && a.emailAddress.address) || ""; }).filter(Boolean).join(", ") || "No attendees";
  return (i + 1) + ". " + e.subject + "\\n   " + startTime + " - " + endTime + "\\n   Location: " + loc + "\\n   Attendees: " + attendees;
});

return events.length + " event" + (events.length !== 1 ? "s" : "") + " " + period + ":\\n\\n" + lines.join("\\n\\n");`;

async function deploy() {
  console.log('Fetching...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();

  // Add Email Tool
  wf.nodes.push({
    parameters: {
      name: 'get_email',
      description: 'Checks the advisor\'s Exchange email inbox. Use when asked about new emails, unread messages, "do I have any new mail", "check my email", emails from a specific person, or emails about a specific subject. Returns subject, sender, date, read status, and preview.',
      jsCode: EMAIL_CODE
    },
    id: 'tool-email-001',
    name: 'Email Tool',
    type: '@n8n/n8n-nodes-langchain.toolCode',
    typeVersion: 1,
    position: [1840, 520]
  });
  wf.connections['Email Tool'] = {
    ai_tool: [[{ node: 'DAX Agent', type: 'ai_tool', index: 0 }]]
  };
  console.log('  Added get_email tool');

  // Add Calendar Tool
  wf.nodes.push({
    parameters: {
      name: 'get_calendar',
      description: 'Checks the advisor\'s Exchange/Outlook calendar. Use when asked about upcoming meetings, "what\'s on my calendar", today\'s schedule, tomorrow\'s meetings, this week\'s calendar, or any scheduling question.',
      jsCode: CALENDAR_CODE
    },
    id: 'tool-calendar-001',
    name: 'Calendar Tool',
    type: '@n8n/n8n-nodes-langchain.toolCode',
    typeVersion: 1,
    position: [2020, 520]
  });
  wf.connections['Calendar Tool'] = {
    ai_tool: [[{ node: 'DAX Agent', type: 'ai_tool', index: 0 }]]
  };
  console.log('  Added get_calendar tool');

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
  console.log('  Activated. 7 tools total.');
}

deploy().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
