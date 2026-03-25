/**
 * Fix Meeting Prep Tool — remove optional chaining (?.),
 * n8n Code tool sandbox may not support it.
 * Run: node scripts/fix-meeting-prep-syntax.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '3tniyxZREqfnAbfo';
const WB_KEY = '2565bf3734934e0facbe77c7c2accd40';
const GRAPH_TENANT = 'd2a3c346-00f3-47dd-a53e-caa3fca74714';
const GRAPH_CLIENT_ID = '218064ac-bee2-4246-9709-ae7518ae71cb';
const GRAPH_CLIENT_SECRET = '6LR8Q~ZCn5FTBlg894LtCGlXZ9GV3NAhS4BY9bla';

// No optional chaining, no template literals — pure ES5-compatible code
const PREP_CODE = `const https = require('https');
const query = $input.all()[0].json;
const clientName = (query.clientName || query.client_name || query.query || query.name || query.client || '').trim();
if (!clientName) return 'Please provide a client name.';

function httpGet(url, headers) {
  return new Promise(function(resolve) {
    var u = new URL(url);
    var opts = { hostname: u.hostname, path: u.pathname + u.search, headers: Object.assign({ 'User-Agent': 'Mozilla/5.0' }, headers || {}) };
    https.get(opts, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() { try { resolve(JSON.parse(data)); } catch(e) { resolve({ raw: data }); } });
      res.on('error', function() { resolve({}); });
    }).on('error', function() { resolve({}); });
  });
}

function httpPost(url, body, headers) {
  return new Promise(function(resolve) {
    var u = new URL(url);
    var d = JSON.stringify(body);
    var req = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) }, headers || {}) }, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() { try { resolve(JSON.parse(data)); } catch(e) { resolve({}); } });
    });
    req.on('error', function() { resolve({}); });
    req.write(d);
    req.end();
  });
}

function parseMoney(v) { return parseFloat(String(v || '0').replace(/[\\$,]/g, '')) || 0; }

// 1. Fetch Wealthbox contacts
var allData = await httpGet('https://api.crmworkspace.com/v1/contacts?per_page=250', { 'ACCESS_TOKEN': '${WB_KEY}' });
var allContacts = allData.contacts || [];
var contact = null;
for (var i = 0; i < allContacts.length; i++) {
  if (allContacts[i].name && allContacts[i].name.toLowerCase().indexOf(clientName.toLowerCase()) >= 0) {
    contact = allContacts[i];
    break;
  }
}
if (!contact) return 'Could not find client "' + clientName + '" in Wealthbox.';

var bg = contact.background_info || '';
var riskProfile = contact.risk_tolerance || 'Not specified';
var objective = contact.investment_objective || 'Not specified';
var horizon = contact.time_horizon || 'Not specified';
var tags = (contact.tags || []).map(function(t) { return typeof t === 'object' ? t.name : String(t); });
var cf = contact.custom_fields || [];
var accountNum = '';
for (var j = 0; j < cf.length; j++) { if (cf[j].name === 'account_number') { accountNum = cf[j].value; break; } }

// 2. Fetch notes
var notesData = await httpGet('https://api.crmworkspace.com/v1/notes?contact_id=' + contact.id + '&per_page=5', { 'ACCESS_TOKEN': '${WB_KEY}' });
var notes = notesData.status_updates || [];
var noteContent = '';
for (var k = 0; k < notes.length; k++) {
  var noteTags = notes[k].tags || [];
  var isMeeting = false;
  for (var l = 0; l < noteTags.length; l++) {
    if ((noteTags[l].name || noteTags[l]) === 'Meeting') { isMeeting = true; break; }
  }
  if (isMeeting) { noteContent = notes[k].content || ''; break; }
}
if (!noteContent && notes.length > 0) noteContent = notes[0].content || '';

// Parse action items
var actions = [];
var actionRegex = /\\((\\d+)\\)\\s+([^,.(]+)/g;
var match;
while ((match = actionRegex.exec(noteContent)) !== null && actions.length < 3) {
  actions.push(match[2].trim());
}

// 3. Get SPY benchmark
var spyData = await httpGet('https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=1d', {});
var spyInfo = 'N/A';
var chart = spyData.chart;
if (chart && chart.result && chart.result[0] && chart.result[0].meta) {
  var meta = chart.result[0].meta;
  var chg = ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100).toFixed(2);
  spyInfo = '$' + meta.regularMarketPrice.toFixed(2) + ' (' + (chg >= 0 ? '+' : '') + chg + '% today)';
}

// 4. Get Exchange calendar
var graphToken = '';
var tokenBody = 'client_id=${GRAPH_CLIENT_ID}&client_secret=${GRAPH_CLIENT_SECRET}&scope=https://graph.microsoft.com/.default&grant_type=client_credentials';
var tokenRes = await new Promise(function(resolve) {
  var req = https.request({ hostname: 'login.microsoftonline.com', path: '/${GRAPH_TENANT}/oauth2/v2.0/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(tokenBody) } }, function(res) {
    var d = '';
    res.on('data', function(c) { d += c; });
    res.on('end', function() { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
  });
  req.on('error', function() { resolve({}); });
  req.write(tokenBody);
  req.end();
});
graphToken = tokenRes.access_token || '';

var nextCalMeeting = 'None found on calendar';
if (graphToken) {
  var now = new Date().toISOString();
  var calData = await httpGet("https://graph.microsoft.com/v1.0/users/richard@dakona.com/events?$top=20&$select=subject,start,bodyPreview&$orderby=start/dateTime&$filter=start/dateTime ge '" + now + "'", { 'Authorization': 'Bearer ' + graphToken });
  var events = calData.value || [];
  var firstName = clientName.split(' ')[0].toLowerCase();
  for (var e = 0; e < events.length; e++) {
    if ((events[e].subject || '').toLowerCase().indexOf(firstName) >= 0) {
      nextCalMeeting = events[e].subject + ' — ' + new Date(events[e].start.dateTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Chicago' });
      break;
    }
  }
}

// 5. Build talking points
var talkingPoints = ['Review portfolio performance vs ' + objective + ' objective'];
if (actions.length > 0) talkingPoints.push('Follow up on ' + actions.length + ' outstanding action items');
if (tags.indexOf('ESG Investing') >= 0) talkingPoints.push('Client interested in ESG — discuss sustainable options');
if (tags.indexOf('College Planning') >= 0) talkingPoints.push('College planning priority — review 529 status');
if (tags.indexOf('Estate Planning') >= 0) talkingPoints.push('Estate planning — consider trust review');
if (tags.indexOf('Retirement Planning') >= 0) talkingPoints.push('Retirement focus — review timeline');
if (tags.indexOf('Golf') >= 0) talkingPoints.push('Personal: client enjoys golf');
if (tags.indexOf('Philanthropy') >= 0) talkingPoints.push('Philanthropy focus — charitable giving strategies');

// 6. Audit log
var timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'full', timeStyle: 'short' });
await httpPost('https://api.crmworkspace.com/v1/notes', {
  content: '[DAX] Meeting Prep Brief Accessed\\nDate: ' + timestamp + '\\nAdvisor: Demo Advisor\\nGenerated by DAX v0.5.0 | Dakona LLC',
  linked_to: [{ id: contact.id, type: 'Contact' }],
  tags: [{ name: 'DAX' }, { name: 'Automated' }]
}, { 'ACCESS_TOKEN': '${WB_KEY}' });

// 7. Format brief
var lines = [
  '═══════════════════════════════════════════',
  'MEETING PREP BRIEF — ' + contact.name.toUpperCase(),
  new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
  '═══════════════════════════════════════════',
  '',
  'CLIENT SNAPSHOT',
  'Name: ' + contact.name,
  'Account: ' + (accountNum || 'N/A'),
  'Risk Profile: ' + riskProfile,
  'Objective: ' + objective,
  'Time Horizon: ' + horizon,
  'Interests: ' + (tags.join(', ') || 'None'),
  bg ? 'Background: ' + bg.substring(0, 250) : '',
  '',
  'MARKET CONTEXT',
  'SPY (S&P 500): ' + spyInfo,
  '',
  'LAST MEETING NOTES',
  noteContent ? noteContent.substring(0, 400) : 'No recent meeting notes',
  '',
  'OUTSTANDING ACTION ITEMS',
  actions.length > 0 ? actions.map(function(a, i) { return (i + 1) + '. ' + a; }).join('\\n') : 'No open action items',
  '',
  'NEXT SCHEDULED MEETING',
  nextCalMeeting,
  '',
  'KEY TALKING POINTS',
  talkingPoints.map(function(p, i) { return (i + 1) + '. ' + p; }).join('\\n'),
  '',
  '— Generated by DAX | Dakona LLC —'
];

return lines.join('\\n');`;

async function deploy() {
  console.log('Fetching...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();
  const prep = wf.nodes.find(n => n.name === 'Meeting Prep Tool');
  prep.parameters.jsCode = PREP_CODE;
  console.log('Updated with ES5-compatible code');

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
  console.log('Activated');
}

deploy().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
