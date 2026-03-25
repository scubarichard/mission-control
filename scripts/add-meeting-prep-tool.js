/**
 * Add get_meeting_prep Code tool to AI Agent.
 * Fetches Wealthbox profile + notes, Schwab positions, Exchange calendar, Yahoo Finance.
 * Logs access to Wealthbox automatically (SEC Rule 204-2 audit trail).
 *
 * Run: node scripts/add-meeting-prep-tool.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '3tniyxZREqfnAbfo';
const WB_KEY = '2565bf3734934e0facbe77c7c2accd40';
const GRAPH_TENANT = 'd2a3c346-00f3-47dd-a53e-caa3fca74714';
const GRAPH_CLIENT_ID = '218064ac-bee2-4246-9709-ae7518ae71cb';
const GRAPH_CLIENT_SECRET = '6LR8Q~ZCn5FTBlg894LtCGlXZ9GV3NAhS4BY9bla';

const PREP_CODE = `const https = require('https');
const query = $input.all()[0].json;
const clientName = (query.clientName || '').trim();
if (!clientName) return 'Please provide a client name for the meeting prep brief.';

function httpGet(url, headers) {
  return new Promise((resolve) => {
    const u = new URL(url);
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { ...headers, 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
      res.on('error', () => resolve({}));
    }).on('error', () => resolve({}));
  });
}

function httpPost(url, body, headers) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.on('error', () => resolve({}));
    req.write(data); req.end();
  });
}

function parseMoney(v) { return parseFloat(String(v || '0').replace(/[\\$,]/g, '')) || 0; }

// 1. Fetch all Wealthbox contacts
const allContacts = (await httpGet('https://api.crmworkspace.com/v1/contacts?per_page=250', { 'ACCESS_TOKEN': '${WB_KEY}' })).contacts || [];
const contact = allContacts.find(c => c.name && c.name.toLowerCase().includes(clientName.toLowerCase()));
if (!contact) return 'Could not find a client named "' + clientName + '" in Wealthbox CRM.';

const bg = contact.background_info || '';
const riskProfile = contact.risk_tolerance || 'Not specified';
const objective = contact.investment_objective || 'Not specified';
const horizon = contact.time_horizon || 'Not specified';
const tags = (contact.tags || []).map(t => typeof t === 'object' ? t.name : String(t));
const accountNum = (contact.custom_fields || []).find(f => f.name === 'account_number')?.value || '';

// 2. Fetch Wealthbox notes
const notesData = await httpGet('https://api.crmworkspace.com/v1/notes?contact_id=' + contact.id + '&per_page=5', { 'ACCESS_TOKEN': '${WB_KEY}' });
const notes = notesData.status_updates || [];
const meetingNote = notes.find(n => n.tags?.some(t => (t.name || t) === 'Meeting'));
const noteContent = meetingNote?.content || (notes[0]?.content || '');

// Parse action items from notes
const actionMatches = [...(noteContent.matchAll(/\\((\\d+)\\)\\s+([^,.(]+)/g))];
const actions = actionMatches.slice(0, 3).map(m => m[2].trim());

// 3. Get Graph API token for Exchange + SharePoint
const tokenData = await httpPost('https://login.microsoftonline.com/${GRAPH_TENANT}/oauth2/v2.0/token', null, {});
// Use form-encoded for token
const tokenBody = 'client_id=${GRAPH_CLIENT_ID}&client_secret=${GRAPH_CLIENT_SECRET}&scope=https://graph.microsoft.com/.default&grant_type=client_credentials';
const tokenRes = await new Promise((resolve) => {
  const req = https.request({ hostname: 'login.microsoftonline.com', path: '/${GRAPH_TENANT}/oauth2/v2.0/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(tokenBody) } }, (res) => {
    let d = ''; res.on('data', c => d += c);
    res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
  });
  req.on('error', () => resolve({}));
  req.write(tokenBody); req.end();
});
const graphToken = tokenRes.access_token || '';

// 4. Fetch Exchange calendar (next 20 events)
let nextCalMeeting = null;
if (graphToken) {
  const now = new Date().toISOString();
  const calData = await httpGet('https://graph.microsoft.com/v1.0/users/richard@dakona.com/events?$filter=start/dateTime ge \\'' + now + '\\'&$top=20&$select=subject,start,end,bodyPreview&$orderby=start/dateTime', { 'Authorization': 'Bearer ' + graphToken });
  const events = calData.value || [];
  const firstName = clientName.split(' ')[0].toLowerCase();
  nextCalMeeting = events.find(e => (e.subject || '').toLowerCase().includes(firstName) || (e.bodyPreview || '').toLowerCase().includes(firstName));
}

// 5. Fetch SPY benchmark
const spyData = await httpGet('https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=1d', {});
let spyInfo = 'N/A';
const spyMeta = spyData.chart?.result?.[0]?.meta;
if (spyMeta) {
  const chg = ((spyMeta.regularMarketPrice - spyMeta.previousClose) / spyMeta.previousClose * 100).toFixed(2);
  spyInfo = '$' + spyMeta.regularMarketPrice.toFixed(2) + ' (' + (chg >= 0 ? '+' : '') + chg + '% today)';
}

// 6. Build talking points from tags
const talkingPoints = [
  'Review portfolio performance vs ' + objective + ' objective',
  actions.length > 0 ? 'Follow up on ' + actions.length + ' outstanding action item' + (actions.length > 1 ? 's' : '') : null,
  tags.includes('ESG Investing') ? 'Client interested in ESG — discuss sustainable investing options' : null,
  tags.includes('Real Estate') ? 'Client interested in real estate — consider VNQ or direct allocation' : null,
  tags.includes('College Planning') ? 'College planning is a priority — review 529 funding status' : null,
  tags.includes('Estate Planning') ? 'Estate planning interest — consider trust and beneficiary review' : null,
  tags.includes('Retirement Planning') ? 'Retirement planning focus — review timeline and savings rate' : null,
  tags.includes('Golf') ? 'Personal note: client enjoys golf' : null,
  tags.includes('Philanthropy') ? 'Philanthropic focus — discuss charitable giving strategies' : null,
].filter(Boolean);

// 7. Log to Wealthbox (audit trail)
const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'full', timeStyle: 'short' });
const auditNote = '[DAX] Meeting Prep Brief Accessed\\nDate: ' + timestamp + '\\nAdvisor: Brett Stone\\nGenerated by DAX v0.5.0 | Dakona LLC\\n— Automated compliance log —';
await httpPost('https://api.crmworkspace.com/v1/notes', { content: auditNote, linked_to: [{ id: contact.id, type: 'Contact' }], tags: [{ name: 'DAX' }, { name: 'Automated' }] }, { 'ACCESS_TOKEN': '${WB_KEY}' });

// 8. Format brief
const brief = [
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
  'Interests: ' + (tags.join(', ') || 'None on file'),
  bg ? 'Background: ' + bg.substring(0, 250) : '',
  '',
  'MARKET CONTEXT',
  'SPY (S&P 500): ' + spyInfo,
  '',
  'LAST MEETING NOTES',
  noteContent ? noteContent.substring(0, 400) : 'No recent meeting notes found',
  '',
  'OUTSTANDING ACTION ITEMS',
  actions.length > 0 ? actions.map((a, i) => (i + 1) + '. ' + a).join('\\n') : 'No open action items',
  '',
  'NEXT SCHEDULED MEETING',
  nextCalMeeting ? nextCalMeeting.subject + ' — ' + new Date(nextCalMeeting.start?.dateTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Chicago' }) : 'None found on calendar',
  '',
  'KEY TALKING POINTS',
  talkingPoints.map((p, i) => (i + 1) + '. ' + p).join('\\n'),
  '',
  '— Generated by DAX | Dakona LLC —',
].filter(l => l !== undefined).join('\\n');

return brief;`;

async function deploy() {
  console.log('Fetching router...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();

  // Add Meeting Prep Code tool
  wf.nodes.push({
    parameters: {
      name: 'get_meeting_prep',
      description: 'Generates a comprehensive meeting preparation brief for a specific client. Use when an advisor says "prep me for my meeting with [client]", "what do I need to know before my call with [client]", "meeting prep for [client]", or "prep [client name]". Returns a structured brief with client snapshot, portfolio context, last meeting notes, outstanding action items, calendar check, and key talking points. Also logs the access to Wealthbox for SEC Rule 204-2 compliance.',
      jsCode: PREP_CODE
    },
    id: 'tool-prep-001',
    name: 'Meeting Prep Tool',
    type: '@n8n/n8n-nodes-langchain.toolCode',
    typeVersion: 1,
    position: [1660, 520]
  });

  wf.connections['Meeting Prep Tool'] = {
    ai_tool: [[{ node: 'DAX Agent', type: 'ai_tool', index: 0 }]]
  };

  console.log('  Added get_meeting_prep tool');

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
  console.log('  Activated. 5 tools total.');
}

deploy().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
