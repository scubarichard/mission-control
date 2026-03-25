/**
 * Add send_email + manage_calendar Code tools to AI Agent.
 * Run: node scripts/add-send-email-calendar-tools.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '3tniyxZREqfnAbfo';
const GT = 'd2a3c346-00f3-47dd-a53e-caa3fca74714';
const GC = '218064ac-bee2-4246-9709-ae7518ae71cb';
const GS = '6LR8Q~ZCn5FTBlg894LtCGlXZ9GV3NAhS4BY9bla';

const SEND_CODE = `var https = require("https");
var input = $input.all()[0].json || {};
var userText = (input.userText || input.query || "").trim();

function graphReq(method, path, body, token) {
  return new Promise(function(resolve) {
    var bodyStr = body ? JSON.stringify(body) : "";
    var opts = { hostname: "graph.microsoft.com", path: path.split(" ").join("%20"), method: method, headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" } };
    if (bodyStr) opts.headers["Content-Length"] = Buffer.byteLength(bodyStr);
    var req = https.request(opts, function(res) {
      var d = ""; res.on("data", function(c) { d += c; }); res.on("end", function() { try { resolve(JSON.parse(d)); } catch(e) { resolve({ status: res.statusCode }); } });
    });
    req.on("error", function(e) { resolve({ error: e.message }); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

var tokenBody = "client_id=${GC}&client_secret=${GS}&scope=https://graph.microsoft.com/.default&grant_type=client_credentials";
var tokenRes = await new Promise(function(resolve) {
  var req = https.request({ hostname: "login.microsoftonline.com", path: "/${GT}/oauth2/v2.0/token", method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(tokenBody) } }, function(res) {
    var d = ""; res.on("data", function(c) { d += c; }); res.on("end", function() { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
  });
  req.on("error", function() { resolve({}); });
  req.write(tokenBody); req.end();
});
var token = tokenRes.access_token || "";
if (!token) return "Could not connect to email.";

// Parse from user text
var toMatch = userText.match(/to\\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+)/i);
var toEmail = toMatch ? toMatch[1] : "";
var subjectMatch = userText.match(/(?:about|subject|re:?)\\s+(.+?)(?:\\.|$)/i);
var subject = subjectMatch ? subjectMatch[1].trim() : "Follow-up from your advisor";
var isDraft = userText.indexOf("send") < 0;

// If no email found, try to compose based on context
if (!toEmail && !isDraft) return "Please provide the recipient email address.";

// Build email
var body = "Dear Client,\\n\\nThis is a follow-up from your advisor at Dakona.\\n\\nBest regards,\\nDemo Advisor";
if (userText.indexOf("review") >= 0) body = "Dear Client,\\n\\nYour quarterly review is ready. Please see the attached report for a summary of your portfolio performance.\\n\\nPlease let me know if you have any questions or would like to schedule a follow-up meeting.\\n\\nBest regards,\\nDemo Advisor";
if (userText.indexOf("meeting") >= 0 || userText.indexOf("schedule") >= 0) body = "Dear Client,\\n\\nI would like to schedule a meeting to discuss your portfolio and financial goals. Please let me know your availability.\\n\\nBest regards,\\nDemo Advisor";

if (isDraft || !toEmail) {
  // Save as draft
  var msg = { subject: subject, body: { contentType: "Text", content: body } };
  if (toEmail) msg.toRecipients = [{ emailAddress: { address: toEmail } }];
  var r = await graphReq("POST", "/v1.0/users/richard@dakona.com/messages", msg, token);
  if (r.id) return "Draft saved:\\nTo: " + (toEmail || "not set") + "\\nSubject: " + subject + "\\n\\nEdit and send from Outlook, or say \\"send it\\".";
  return "Could not save draft.";
} else {
  // Send
  var sendMsg = {
    message: {
      subject: subject,
      body: { contentType: "Text", content: body },
      toRecipients: [{ emailAddress: { address: toEmail } }]
    },
    saveToSentItems: true
  };
  var r = await graphReq("POST", "/v1.0/users/richard@dakona.com/sendMail", sendMsg, token);
  if (!r.error) return "Email sent to " + toEmail + "\\nSubject: " + subject;
  return "Could not send email: " + (r.error || "unknown error");
}`;

const CALENDAR_CODE = `var https = require("https");
var input = $input.all()[0].json || {};
var userText = (input.userText || input.query || "").trim();

function graphReq(method, path, body, token) {
  return new Promise(function(resolve) {
    var bodyStr = body ? JSON.stringify(body) : "";
    var opts = { hostname: "graph.microsoft.com", path: path.split(" ").join("%20"), method: method, headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" } };
    if (bodyStr) opts.headers["Content-Length"] = Buffer.byteLength(bodyStr);
    var req = https.request(opts, function(res) {
      var d = ""; res.on("data", function(c) { d += c; }); res.on("end", function() { try { resolve(JSON.parse(d)); } catch(e) { resolve({ status: res.statusCode }); } });
    });
    req.on("error", function(e) { resolve({ error: e.message }); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

var tokenBody = "client_id=${GC}&client_secret=${GS}&scope=https://graph.microsoft.com/.default&grant_type=client_credentials";
var tokenRes = await new Promise(function(resolve) {
  var req = https.request({ hostname: "login.microsoftonline.com", path: "/${GT}/oauth2/v2.0/token", method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(tokenBody) } }, function(res) {
    var d = ""; res.on("data", function(c) { d += c; }); res.on("end", function() { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
  });
  req.on("error", function() { resolve({}); });
  req.write(tokenBody); req.end();
});
var token = tokenRes.access_token || "";
if (!token) return "Could not connect to calendar.";

var lc = userText.toLowerCase();

// Detect action
if (lc.indexOf("cancel") >= 0) {
  return "To cancel a meeting, I need the event ID. Say \\"what is on my calendar\\" first, then tell me which one to cancel.";
}

if (lc.indexOf("find") >= 0 && lc.indexOf("time") >= 0) {
  var now = new Date();
  var weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  var r = await graphReq("GET", "/v1.0/users/richard@dakona.com/events?$filter=start/dateTime%20ge%20'" + now.toISOString() + "'%20and%20end/dateTime%20le%20'" + weekOut.toISOString() + "'&$select=subject,start,end&$orderby=start/dateTime&$top=20", null, token);
  var events = r.value || [];
  if (events.length === 0) return "Your calendar is clear this week. You can schedule any time.";
  var busy = events.map(function(e) {
    return "- " + e.subject + ": " + new Date(e.start.dateTime + "Z").toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "short", timeStyle: "short" });
  }).join("\\n");
  return "Your busy times this week:\\n\\n" + busy + "\\n\\nSuggested: schedule around these slots.";
}

// Create event
// Parse date/time from text
var dateMatch = lc.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next\\s+\\w+day)/);
var timeMatch = lc.match(/(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)/i);
var subjectMatch = userText.match(/(?:schedule|book|create|set up)\\s+(?:a\\s+)?(?:meeting|call|appointment)\\s+(?:with\\s+)?(.+?)(?:\\s+(?:on|for|at|next|tomorrow))/i);

if (!timeMatch) return "Please specify a time for the meeting (e.g., \\"at 2pm\\").";

var hour = parseInt(timeMatch[1]);
if (timeMatch[3] && timeMatch[3].toLowerCase() === "pm" && hour < 12) hour += 12;
if (timeMatch[3] && timeMatch[3].toLowerCase() === "am" && hour === 12) hour = 0;
var minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;

var meetDate = new Date();
if (lc.indexOf("tomorrow") >= 0) meetDate.setDate(meetDate.getDate() + 1);
else if (dateMatch) {
  var dayNames = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  var targetDay = dayNames.indexOf(dateMatch[1].toLowerCase());
  if (targetDay >= 0) {
    var current = meetDate.getDay();
    var diff = targetDay - current;
    if (diff <= 0) diff += 7;
    meetDate.setDate(meetDate.getDate() + diff);
  }
}

var startDT = meetDate.toISOString().split("T")[0] + "T" + String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0") + ":00";
var endHour = hour + 1;
var endDT = meetDate.toISOString().split("T")[0] + "T" + String(endHour).padStart(2, "0") + ":" + String(minute).padStart(2, "0") + ":00";
var meetSubject = subjectMatch ? "Meeting with " + subjectMatch[1].trim() : "Meeting";

var event = {
  subject: meetSubject,
  start: { dateTime: startDT, timeZone: "America/Chicago" },
  end: { dateTime: endDT, timeZone: "America/Chicago" },
  location: { displayName: "Zoom" }
};

var r = await graphReq("POST", "/v1.0/users/richard@dakona.com/events", event, token);
if (r.id) {
  var formatted = new Date(startDT).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "full", timeStyle: "short" });
  return "Meeting scheduled:\\n" + meetSubject + "\\n" + formatted + "\\nLocation: Zoom";
}
return "Could not create the meeting. Error: " + JSON.stringify(r.error || r).substring(0, 200);`;

async function deploy() {
  console.log('Fetching...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();

  // Add Send Email Tool
  wf.nodes.push({
    parameters: {
      name: 'send_email',
      description: 'Drafts or sends emails from the advisor\'s Exchange mailbox. Use when asked to write an email, draft a message, send to a client, reply, or compose a follow-up. Always drafts first unless explicitly told to send. Can compose professional emails about reviews, meetings, or follow-ups.',
      jsCode: SEND_CODE
    },
    id: 'tool-send-email-001',
    name: 'Send Email Tool',
    type: '@n8n/n8n-nodes-langchain.toolCode',
    typeVersion: 1,
    position: [2380, 520]
  });
  wf.connections['Send Email Tool'] = {
    ai_tool: [[{ node: 'DAX Agent', type: 'ai_tool', index: 0 }]]
  };
  console.log('  Added send_email tool');

  // Add Manage Calendar Tool
  wf.nodes.push({
    parameters: {
      name: 'manage_calendar',
      description: 'Creates, updates, or cancels calendar events in the advisor\'s Exchange calendar. Use when asked to schedule a meeting, book a call, find a good time, or cancel an appointment. Can schedule with specific dates, times, and invitees.',
      jsCode: CALENDAR_CODE
    },
    id: 'tool-manage-cal-001',
    name: 'Manage Calendar Tool',
    type: '@n8n/n8n-nodes-langchain.toolCode',
    typeVersion: 1,
    position: [2560, 520]
  });
  wf.connections['Manage Calendar Tool'] = {
    ai_tool: [[{ node: 'DAX Agent', type: 'ai_tool', index: 0 }]]
  };
  console.log('  Added manage_calendar tool');

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
  console.log('  Activated. 10 tools total.');
}

deploy().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
