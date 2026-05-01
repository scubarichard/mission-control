/**
 * Replace list_clients HTTP tool with Code tool — filtering in n8n, not GPT-4o.
 * Run: node scripts/fix-list-clients-code-tool.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '3tniyxZREqfnAbfo';

const LIST_CODE = `const https = require('https');
const query = $input.all()[0].json;
const searchTerm = (query.query || query.searchTerm || query.filter || '').toLowerCase().trim();

const contacts = await new Promise((resolve, reject) => {
  https.get({
    hostname: 'api.crmworkspace.com',
    path: '/v1/contacts?per_page=250',
    headers: { 'ACCESS_TOKEN': process.env.WEALTHBOX_TOKEN }
  }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => { try { resolve(JSON.parse(data).contacts || []); } catch { resolve([]); } });
    res.on('error', reject);
  }).on('error', reject);
});

let filtered = contacts;
if (searchTerm) {
  filtered = contacts.filter(c => {
    const tags = (c.tags || []).map(t => (typeof t === 'object' ? t.name : String(t)).toLowerCase());
    const name = (c.name || '').toLowerCase();
    const bg = (c.background_info || '').toLowerCase();
    const risk = (c.risk_tolerance || '').toLowerCase();
    const objective = (c.investment_objective || '').toLowerCase();
    const interests = (c.personal_interests || '').toLowerCase();
    const all = name + ' ' + bg + ' ' + risk + ' ' + objective + ' ' + interests + ' ' + tags.join(' ');
    return all.includes(searchTerm);
  });
}

const getAcct = (cf) => { const f = (cf || []).find(x => x.name === 'account_number'); return f ? f.value : 'N/A'; };

const list = filtered.map(c => {
  const tags = (c.tags || []).map(t => typeof t === 'object' ? t.name : String(t));
  return '- ' + c.name + ' | Acct: ' + getAcct(c.custom_fields) + ' | Risk: ' + (c.risk_tolerance || 'N/A') + ' | Obj: ' + (c.investment_objective || 'N/A') + (tags.length ? ' | Tags: ' + tags.join(', ') : '');
}).join('\\n');

const result = filtered.length > 0
  ? 'Found ' + filtered.length + ' of ' + contacts.length + ' clients' + (searchTerm ? ' matching "' + searchTerm + '"' : '') + ':\\n\\n' + list
  : 'No clients found matching "' + searchTerm + '". Total clients: ' + contacts.length;

return result;`;

async function update() {
  console.log('Fetching...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();

  // Remove old tool
  wf.nodes = wf.nodes.filter(n => n.name !== 'List Clients Tool');
  delete wf.connections['List Clients Tool'];

  // Add Code tool
  wf.nodes.push({
    parameters: {
      name: 'list_clients',
      description: 'Lists and filters clients from Wealthbox CRM. Pass a search/filter term to find clients by name, tag, interest, risk profile, investment objective, or any keyword. Examples: "golf", "Simpson", "moderate", "ESG", "philanthropy", "aggressive growth". Pass empty string to list all clients.',
      jsCode: LIST_CODE
    },
    id: 'tool-list-code-001',
    name: 'List Clients Tool',
    type: '@n8n/n8n-nodes-langchain.toolCode',
    typeVersion: 1,
    position: [1480, 520]
  });

  wf.connections['List Clients Tool'] = {
    ai_tool: [[{ node: 'DAX Agent', type: 'ai_tool', index: 0 }]]
  };

  console.log('Replaced with Code tool');

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

update().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
