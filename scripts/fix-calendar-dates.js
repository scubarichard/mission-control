/**
 * Fix calendar date formatting — explicit dates prevent hallucination.
 * Also add calendar instructions to agent system prompt.
 * Run: node scripts/fix-calendar-dates.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '3tniyxZREqfnAbfo';

const CALENDAR_CODE = `var https = require("https");
var input = $input.all()[0].json || {};
var userText = (input.userText || input.query || "").toLowerCase();
var TZ = "America/Chicago";

var tokenBody = "client_id=" + process.env.GRAPH_CLIENT_ID + "&client_secret=" + encodeURIComponent(process.env.GRAPH_CLIENT_SECRET) + "&scope=https://graph.microsoft.com/.default&grant_type=client_credentials";
var tokenRes = await new Promise(function(resolve) {
  var req = https.request({ hostname: "login.microsoftonline.com", path: "/" + process.env.GRAPH_TENANT_ID + "/oauth2/v2.0/token", method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(tokenBody) } }, function(res) {
    var d = ""; res.on("data", function(c) { d += c; }); res.on("end", function() { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
  });
  req.on("error", function() { resolve({}); });
  req.write(tokenBody); req.end();
});
var token = tokenRes.access_token || "";
if (!token) return "Could not connect to calendar.";

// Today's date formatted explicitly
var todayFormatted = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: TZ });

// Determine time range
var now = new Date();
var timeMin, timeMax, period;
if (userText.indexOf("tomorrow") >= 0) {
  var tom = new Date(); tom.setDate(tom.getDate() + 1);
  timeMin = tom.toISOString().split("T")[0] + "T00:00:00Z";
  timeMax = tom.toISOString().split("T")[0] + "T23:59:59Z";
  period = "tomorrow";
} else if (userText.indexOf("week") >= 0) {
  timeMin = now.toISOString();
  var weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
  timeMax = weekEnd.toISOString();
  period = "this week";
} else {
  var todayStr = now.toISOString().split("T")[0];
  timeMin = todayStr + "T00:00:00Z";
  timeMax = todayStr + "T23:59:59Z";
  period = "today";
}

var path = "/v1.0/users/rmabbun@dakona.com/events?$top=20&$select=subject,start,end,location,attendees,bodyPreview&$orderby=start/dateTime&$filter=start/dateTime%20ge%20'" + encodeURIComponent(timeMin) + "'%20and%20end/dateTime%20le%20'" + encodeURIComponent(timeMax) + "'";

var calData = await new Promise(function(resolve) {
  https.get({ hostname: "graph.microsoft.com", path: path.split(" ").join("%20"), headers: { "Authorization": "Bearer " + token, "Cache-Control": "no-cache", "Pragma": "no-cache" } }, function(res) {
    var d = ""; res.on("data", function(c) { d += c; }); res.on("end", function() { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
  }).on("error", function() { resolve({}); });
});

var events = calData.value || [];
if (events.length === 0) return "Today is " + todayFormatted + ". No calendar events found for " + period + ".";

// Format each event with explicit dates — never raw UTC
var lines = events.map(function(e, i) {
  var isAllDay = !!e.start.date;
  var startStr, endStr, dayStr, dateStr, timeRange;

  if (isAllDay) {
    dayStr = new Date(e.start.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: TZ });
    dateStr = new Date(e.start.date + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: TZ });
    timeRange = "All Day";
  } else {
    var startDT = new Date(e.start.dateTime + "Z");
    var endDT = new Date(e.end.dateTime + "Z");
    dayStr = startDT.toLocaleDateString("en-US", { weekday: "long", timeZone: TZ });
    dateStr = startDT.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: TZ });
    var startTime = startDT.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ });
    var endTime = endDT.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ });
    timeRange = startTime + " - " + endTime;
  }

  var loc = (e.location && e.location.displayName) || "No location";
  var attendees = (e.attendees || []).slice(0, 5).map(function(a) {
    return (a.emailAddress && a.emailAddress.name) || (a.emailAddress && a.emailAddress.address) || "";
  }).filter(Boolean).join(", ") || "No attendees listed";

  return (i + 1) + ". " + e.subject + "\\n   " + dayStr + ", " + dateStr + "\\n   " + timeRange + "\\n   Location: " + loc + "\\n   Attendees: " + attendees;
});

return "Today is " + todayFormatted + ".\\n\\n" + events.length + " event" + (events.length !== 1 ? "s" : "") + " " + period + ":\\n\\n" + lines.join("\\n\\n");`;

const CAL_PROMPT_ADDITION = '\n\nCALENDAR DATA:\nWhen displaying calendar events, always use the EXACT dates and times returned by the get_calendar tool. Never infer, estimate, or guess dates. If the tool returns "Wednesday, March 26, 2026 at 2:30 PM" — display exactly that. Never convert or reformat calendar data. If asked about today\'s date, use the "Today is..." line returned by the tool.';

async function deploy() {
  console.log('Fetching...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();

  // Update Calendar Tool
  const cal = wf.nodes.find(n => n.name === 'Calendar Tool');
  cal.parameters.jsCode = CALENDAR_CODE;
  console.log('  Updated Calendar Tool with explicit date formatting');

  // Update agent prompt
  const agent = wf.nodes.find(n => n.name === 'DAX Agent');
  if (!agent.parameters.options.systemMessage.includes('CALENDAR DATA')) {
    agent.parameters.options.systemMessage += CAL_PROMPT_ADDITION;
    console.log('  Added CALENDAR DATA to system prompt');
  }

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
