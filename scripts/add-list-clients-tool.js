/**
 * Add list_clients tool with intelligent filtering to AI Agent.
 * Creates the DAX List Clients workflow + adds tool to agent.
 * Run: node scripts/add-list-clients-tool.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const ROUTER_WF_ID = '3tniyxZREqfnAbfo';
const WB_KEY = '2565bf3734934e0facbe77c7c2accd40';

// ── List Clients workflow Code ───────────────────────────────────────

const LIST_CODE = `
const body = $json.body || $json;
const filters = body.filters || {};

const states = (filters.states || []).map(s => String(s).toLowerCase().trim());
const cities = (filters.cities || []).map(c => String(c).toLowerCase().trim());
const countries = (filters.countries || []).map(c => String(c).toLowerCase().trim());
const riskProfile = String(filters.riskProfile || '').toLowerCase().trim();
const searchTerm = String(filters.searchTerm || '').toLowerCase().trim();

const stateMap = {
  'texas': 'tx', 'california': 'ca', 'new york': 'ny', 'florida': 'fl',
  'illinois': 'il', 'washington': 'wa', 'colorado': 'co',
  'massachusetts': 'ma', 'georgia': 'ga', 'ohio': 'oh',
  'arizona': 'az', 'nevada': 'nv', 'michigan': 'mi', 'pennsylvania': 'pa',
  'new jersey': 'nj', 'virginia': 'va', 'north carolina': 'nc',
  'minnesota': 'mn', 'wisconsin': 'wi', 'missouri': 'mo',
  'connecticut': 'ct', 'maryland': 'md', 'oregon': 'or', 'tennessee': 'tn',
  'indiana': 'in', 'kentucky': 'ky', 'louisiana': 'la', 'south carolina': 'sc'
};

const expandedStates = [];
for (const s of states) {
  expandedStates.push(s);
  if (stateMap[s]) expandedStates.push(stateMap[s]);
  const full = Object.keys(stateMap).find(k => stateMap[k] === s);
  if (full) expandedStates.push(full);
}

const https = require('https');
const contacts = await new Promise((resolve, reject) => {
  https.get({
    hostname: 'api.crmworkspace.com',
    path: '/v1/contacts?per_page=250',
    headers: { 'ACCESS_TOKEN': '${WB_KEY}' }
  }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      try { resolve(JSON.parse(data).contacts || []); }
      catch(e) { resolve([]); }
    });
    res.on('error', reject);
  }).on('error', reject);
});

console.log('[ListClients] Total contacts:', contacts.length);

const hasFilters = expandedStates.length > 0 || cities.length > 0 ||
                   countries.length > 0 || riskProfile || searchTerm;

let filtered = contacts;
if (hasFilters) {
  filtered = contacts.filter(c => {
    const bg = (c.background_info || '').toLowerCase();
    const name = (c.name || '').toLowerCase();
    const firstName = (c.first_name || '').toLowerCase();
    const lastName = (c.last_name || '').toLowerCase();
    const addr = (c.street_addresses || []).map(a => JSON.stringify(a).toLowerCase()).join(' ');
    const risk = (c.risk_tolerance || '').toLowerCase();
    const combined = bg + ' ' + name + ' ' + firstName + ' ' + lastName + ' ' + addr + ' ' + risk;

    if (expandedStates.length > 0 && !expandedStates.some(s => combined.includes(s))) return false;
    if (cities.length > 0 && !cities.some(ci => combined.includes(ci))) return false;
    if (countries.length > 0 && !countries.some(co => combined.includes(co))) return false;
    if (riskProfile && !combined.includes(riskProfile)) return false;
    if (searchTerm && !combined.includes(searchTerm)) return false;
    return true;
  });
}

const getAcct = (cf) => { const f = (cf || []).find(x => x.name === 'account_number'); return f ? f.value : 'N/A'; };

const list = filtered.map(c =>
  '- ' + c.name + ' | Account: ' + getAcct(c.custom_fields) + ' | Risk: ' + (c.risk_tolerance || 'N/A')
).join('\\n');

const filterParts = [];
if (states.length) filterParts.push('location: ' + [...new Set(states)].join(', '));
if (cities.length) filterParts.push('cities: ' + cities.join(', '));
if (countries.length) filterParts.push('countries: ' + countries.join(', '));
if (riskProfile) filterParts.push('risk: ' + riskProfile);
if (searchTerm) filterParts.push('search: "' + searchTerm + '"');
const filterDesc = hasFilters ? 'Filtered by: ' + filterParts.join(' | ') : 'All clients';

const response = filtered.length > 0
  ? filterDesc + '\\n\\nFound ' + filtered.length + ' client' + (filtered.length !== 1 ? 's' : '') + ':\\n\\n' + list + '\\n\\nAsk me about any specific client for full details.'
  : filterDesc + '\\n\\nNo clients found matching those criteria. You have ' + contacts.length + ' total clients in Wealthbox.';

return [{ json: { response, count: filtered.length, total: contacts.length } }];
`.trim();

// ── Create the workflow ──────────────────────────────────────────────

const listWorkflow = {
  name: 'DAX List Clients',
  nodes: [
    {
      parameters: { httpMethod: 'POST', path: 'list-clients', responseMode: 'responseNode', options: {} },
      id: 'lc-webhook-001', name: 'Webhook',
      type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [220, 300]
    },
    {
      parameters: { jsCode: LIST_CODE },
      id: 'lc-filter-001', name: 'Filter Clients',
      type: 'n8n-nodes-base.code', typeVersion: 2, position: [460, 300]
    },
    {
      parameters: { respondWith: 'json', responseBody: '={{ $json }}', options: { responseCode: 200 } },
      id: 'lc-respond-001', name: 'Respond',
      type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [700, 300]
    }
  ],
  connections: {
    'Webhook': { main: [[{ node: 'Filter Clients', type: 'main', index: 0 }]] },
    'Filter Clients': { main: [[{ node: 'Respond', type: 'main', index: 0 }]] }
  },
  settings: { executionOrder: 'v1' }
};

// ── Deploy ───────────────────────────────────────────────────────────

async function deploy() {
  // Create workflow
  console.log('Creating DAX List Clients workflow...');
  const cr = await fetch(`${N8N_URL}/api/v1/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify(listWorkflow)
  });
  const created = await cr.json();
  if (!created.id) { console.error('Failed:', JSON.stringify(created).substring(0, 300)); process.exit(1); }
  console.log('  Created:', created.id);
  await fetch(`${N8N_URL}/api/v1/workflows/${created.id}/activate`, {
    method: 'POST', headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  console.log('  Activated');

  // Add tool to agent
  console.log('\nAdding list_clients tool to AI Agent...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${ROUTER_WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const router = await resp.json();

  router.nodes.push({
    parameters: {
      name: 'list_clients',
      description: 'Lists clients from Wealthbox CRM with optional filtering. Use when advisor asks to see clients, list clients, show clients filtered by location (city, state, country), risk profile, last name, first name, or any keyword. Extract filter values from the natural language request. For unfiltered "show all clients" pass empty filters.',
      url: 'https://n8n.dakona.net/webhook/list-clients',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: `={"filters":{"states":{{ $fromAI('states', 'Array of US state names or abbreviations to filter by, empty array for no filter', 'array', []) }},"cities":{{ $fromAI('cities', 'Array of city names to filter by, empty array for no filter', 'array', []) }},"countries":{{ $fromAI('countries', 'Array of countries to filter by, empty array for no filter', 'array', []) }},"riskProfile":"{{ $fromAI('riskProfile', 'Risk profile filter e.g. Conservative, Moderate, Aggressive. Empty string for no filter', 'string', '') }}","searchTerm":"{{ $fromAI('searchTerm', 'Search term to match against name, background, or notes. Empty string for no filter', 'string', '') }}"}}`,
      method: 'POST',
      placeholderDefinitions: { values: [] }
    },
    id: 'tool-list-001',
    name: 'List Clients Tool',
    type: '@n8n/n8n-nodes-langchain.toolHttpRequest',
    typeVersion: 1.1,
    position: [1480, 520]
  });

  router.connections['List Clients Tool'] = {
    ai_tool: [[{ node: 'DAX Agent', type: 'ai_tool', index: 0 }]]
  };

  const putResp = await fetch(`${N8N_URL}/api/v1/workflows/${ROUTER_WF_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify({ name: router.name, nodes: router.nodes, connections: router.connections, settings: router.settings })
  });
  const result = await putResp.json();
  if (!result.id) { console.error('Failed:', JSON.stringify(result).substring(0, 500)); process.exit(1); }
  await fetch(`${N8N_URL}/api/v1/workflows/${ROUTER_WF_ID}/activate`, {
    method: 'POST', headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  console.log('  Updated + activated. Nodes:', result.nodes?.length);
  console.log('\n  Agent now has 4 tools: generate_quarterly_reports, get_client_info, get_market_data, list_clients');
}

deploy().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
