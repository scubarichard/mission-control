/**
 * Deploy two n8n workflows for DAX compliance flagging.
 *   1. DAX Compliance Flagging — webhook checks messages against trigger phrases, posts notes to Wealthbox
 *   2. DAX Compliance Flag Store — stores/retrieves/updates flags via n8n static data
 *
 * Run: node scripts/deploy-compliance-flagging.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';

// ── Workflow 1: DAX Compliance Flagging ─────────────────────────────

const FLAG_CHECK_CODE = `
const input = $input.all()[0].json;
const body = input.body || input;
const userMessage = (body.userMessage || '').toLowerCase();
const daxResponse = (body.daxResponse || '').toLowerCase();
const conversationId = body.conversationId || 'unknown';
const advisorName = body.advisorName || 'Unknown Advisor';
const clientName = body.clientName || '';
const contactId = body.contactId || null;

const defaultTriggers = [
  { phrase: 'should i buy', severity: 'HIGH', reason: 'Potential investment recommendation request' },
  { phrase: 'should i sell', severity: 'HIGH', reason: 'Potential investment recommendation request' },
  { phrase: 'i recommend', severity: 'HIGH', reason: 'Explicit recommendation language' },
  { phrase: 'best investment', severity: 'HIGH', reason: 'Investment recommendation language' },
  { phrase: 'will go up', severity: 'HIGH', reason: 'Price prediction language' },
  { phrase: 'will go down', severity: 'HIGH', reason: 'Price prediction language' },
  { phrase: 'guarantee', severity: 'HIGH', reason: 'Prohibited guarantee language' },
  { phrase: 'guaranteed return', severity: 'CRITICAL', reason: 'Prohibited guarantee of returns' },
  { phrase: 'risk-free', severity: 'CRITICAL', reason: 'Prohibited risk-free claim' },
  { phrase: 'outperform', severity: 'MEDIUM', reason: 'Performance claim language' },
  { phrase: 'promise', severity: 'MEDIUM', reason: 'Promise language' },
  { phrase: 'insider', severity: 'CRITICAL', reason: 'Potential insider information reference' },
  { phrase: 'complaint', severity: 'MEDIUM', reason: 'Client complaint signal' },
  { phrase: 'lawsuit', severity: 'HIGH', reason: 'Legal action reference' },
  { phrase: 'legal action', severity: 'HIGH', reason: 'Legal action reference' },
  { phrase: 'withdraw all', severity: 'MEDIUM', reason: 'Client distress signal' },
  { phrase: 'switch everything', severity: 'MEDIUM', reason: 'Potential churning signal' },
  { phrase: 'move everything', severity: 'MEDIUM', reason: 'Potential churning signal' },
  { phrase: 'market timing', severity: 'MEDIUM', reason: 'Market timing language' },
  { phrase: 'beat the market', severity: 'MEDIUM', reason: 'Performance claim language' },
];

const combined = userMessage + ' ' + daxResponse;
const matches = defaultTriggers.filter(t => combined.includes(t.phrase));

if (matches.length === 0) {
  return [{ json: { flagged: false } }];
}

// Determine highest severity
const severityOrder = { CRITICAL: 3, HIGH: 2, MEDIUM: 1 };
const severity = matches.reduce((max, m) =>
  (severityOrder[m.severity] || 0) > (severityOrder[max] || 0) ? m.severity : max
, 'MEDIUM');

const triggerList = matches.map(m => '- [' + m.severity + '] "' + m.phrase + '" — ' + m.reason).join('\\n');
const timestamp = new Date().toISOString();

const noteContent = '[DAX-REVIEW] Compliance Flag — ' + severity + '\\n' +
  'Flagged: ' + timestamp + '\\n' +
  'Advisor: ' + advisorName + '\\n' +
  (clientName ? 'Client: ' + clientName + '\\n' : '') +
  'Conversation: ' + conversationId + '\\n\\n' +
  'Triggers matched:\\n' + triggerList + '\\n\\n' +
  'User message excerpt: "' + (body.userMessage || '').substring(0, 500) + '"\\n' +
  'DAX response excerpt: "' + (body.daxResponse || '').substring(0, 500) + '"';

// Post note to Wealthbox
const notePayload = {
  content: noteContent,
  tags: ['dax-compliance', severity.toLowerCase()],
};
if (contactId) {
  notePayload.linked_to = [{ id: Number(contactId), type: 'Contact' }];
}

await $http.request({
  method: 'POST',
  url: 'https://api.crmworkspace.com/v1/notes',
  headers: { 'ACCESS_TOKEN': process.env.WEALTHBOX_TOKEN, 'Content-Type': 'application/json' },
  body: notePayload
});

// Store flag via compliance store workflow
const flag = {
  id: 'flag-' + Date.now(),
  timestamp: timestamp,
  severity: severity,
  advisorName: advisorName,
  clientName: clientName,
  contactId: contactId,
  conversationId: conversationId,
  triggers: matches.map(m => ({ phrase: m.phrase, severity: m.severity, reason: m.reason })),
  userMessageExcerpt: (body.userMessage || '').substring(0, 500),
  daxResponseExcerpt: (body.daxResponse || '').substring(0, 500),
  status: 'PENDING'
};

await $http.request({
  method: 'POST',
  url: 'http://localhost:5678/webhook/compliance-store-flag',
  headers: { 'Content-Type': 'application/json' },
  body: flag
});

return [{ json: { flagged: true, severity: severity, matches: matches.length } }];
`.trim();

const workflow1 = {
  name: 'DAX Compliance Flagging',
  nodes: [
    {
      parameters: { httpMethod: 'POST', path: 'compliance-flag-check', responseMode: 'responseNode', options: {} },
      id: 'cf-webhook-001', name: 'Webhook',
      type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [220, 300]
    },
    {
      parameters: { jsCode: FLAG_CHECK_CODE },
      id: 'cf-code-001', name: 'Check Triggers',
      type: 'n8n-nodes-base.code', typeVersion: 2, position: [460, 300]
    },
    {
      parameters: { respondWith: 'json', responseBody: '={{ $json }}', options: { responseCode: 200 } },
      id: 'cf-respond-001', name: 'Respond',
      type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [700, 300]
    }
  ],
  connections: {
    'Webhook': { main: [[{ node: 'Check Triggers', type: 'main', index: 0 }]] },
    'Check Triggers': { main: [[{ node: 'Respond', type: 'main', index: 0 }]] }
  },
  settings: { executionOrder: 'v1' }
};

// ── Workflow 2: DAX Compliance Flag Store ────────────────────────────

const STORE_FLAG_CODE = `
const input = $input.all()[0].json;
const body = input.body || input;
const staticData = $getWorkflowStaticData('global');

if (!staticData.flags) {
  staticData.flags = [];
}

const flag = {
  id: body.id || ('flag-' + Date.now()),
  timestamp: body.timestamp || new Date().toISOString(),
  severity: body.severity || 'MEDIUM',
  advisorName: body.advisorName || 'Unknown',
  clientName: body.clientName || '',
  contactId: body.contactId || null,
  conversationId: body.conversationId || 'unknown',
  triggers: body.triggers || [],
  userMessageExcerpt: body.userMessageExcerpt || '',
  daxResponseExcerpt: body.daxResponseExcerpt || '',
  status: body.status || 'PENDING'
};

staticData.flags.push(flag);

// Keep max 1000 items
if (staticData.flags.length > 1000) {
  staticData.flags = staticData.flags.slice(staticData.flags.length - 1000);
}

return [{ json: { stored: true, flagId: flag.id, total: staticData.flags.length } }];
`.trim();

const GET_FLAGS_CODE = `
const input = $input.all()[0].json;
const query = input.query || {};
const statusFilter = query.status || '';
const staticData = $getWorkflowStaticData('global');

if (!staticData.flags) {
  staticData.flags = [];
}

let flags = staticData.flags;
if (statusFilter) {
  flags = flags.filter(f => f.status === statusFilter);
}

return [{ json: { flags: flags, total: flags.length } }];
`.trim();

const UPDATE_FLAG_CODE = `
const input = $input.all()[0].json;
const body = input.body || input;
const flagId = body.flagId;
const status = body.status;
const reviewerNote = body.reviewerNote || '';
const reviewedBy = body.reviewedBy || '';
const staticData = $getWorkflowStaticData('global');

if (!staticData.flags) {
  staticData.flags = [];
}

const flag = staticData.flags.find(f => f.id === flagId);
if (!flag) {
  return [{ json: { updated: false, error: 'Flag not found: ' + flagId } }];
}

flag.status = status;
flag.reviewerNote = reviewerNote;
flag.reviewedBy = reviewedBy;
flag.reviewedAt = new Date().toISOString();

return [{ json: { updated: true, flagId: flag.id, status: flag.status } }];
`.trim();

const workflow2 = {
  name: 'DAX Compliance Flag Store',
  nodes: [
    // Webhook 1: Store flag (POST)
    {
      parameters: { httpMethod: 'POST', path: 'compliance-store-flag', responseMode: 'responseNode', options: {} },
      id: 'cs-wh-store-001', name: 'Webhook Store',
      type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [220, 200]
    },
    {
      parameters: { jsCode: STORE_FLAG_CODE },
      id: 'cs-code-store-001', name: 'Store Flag',
      type: 'n8n-nodes-base.code', typeVersion: 2, position: [460, 200]
    },
    {
      parameters: { respondWith: 'json', responseBody: '={{ $json }}', options: { responseCode: 200 } },
      id: 'cs-respond-store-001', name: 'Respond Store',
      type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [700, 200]
    },
    // Webhook 2: Get flags (GET)
    {
      parameters: { httpMethod: 'GET', path: 'compliance-flags', responseMode: 'responseNode', options: {} },
      id: 'cs-wh-get-001', name: 'Webhook Get',
      type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [220, 400]
    },
    {
      parameters: { jsCode: GET_FLAGS_CODE },
      id: 'cs-code-get-001', name: 'Get Flags',
      type: 'n8n-nodes-base.code', typeVersion: 2, position: [460, 400]
    },
    {
      parameters: { respondWith: 'json', responseBody: '={{ $json }}', options: { responseCode: 200 } },
      id: 'cs-respond-get-001', name: 'Respond Get',
      type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [700, 400]
    },
    // Webhook 3: Update flag (POST)
    {
      parameters: { httpMethod: 'POST', path: 'compliance-flag-update', responseMode: 'responseNode', options: {} },
      id: 'cs-wh-update-001', name: 'Webhook Update',
      type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [220, 600]
    },
    {
      parameters: { jsCode: UPDATE_FLAG_CODE },
      id: 'cs-code-update-001', name: 'Update Flag',
      type: 'n8n-nodes-base.code', typeVersion: 2, position: [460, 600]
    },
    {
      parameters: { respondWith: 'json', responseBody: '={{ $json }}', options: { responseCode: 200 } },
      id: 'cs-respond-update-001', name: 'Respond Update',
      type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [700, 600]
    }
  ],
  connections: {
    'Webhook Store': { main: [[{ node: 'Store Flag', type: 'main', index: 0 }]] },
    'Store Flag': { main: [[{ node: 'Respond Store', type: 'main', index: 0 }]] },
    'Webhook Get': { main: [[{ node: 'Get Flags', type: 'main', index: 0 }]] },
    'Get Flags': { main: [[{ node: 'Respond Get', type: 'main', index: 0 }]] },
    'Webhook Update': { main: [[{ node: 'Update Flag', type: 'main', index: 0 }]] },
    'Update Flag': { main: [[{ node: 'Respond Update', type: 'main', index: 0 }]] }
  },
  settings: { executionOrder: 'v1' }
};

// ── Deploy ──────────────────────────────────────────────────────────

async function deploy() {
  // Workflow 1: DAX Compliance Flagging
  console.log('Creating DAX Compliance Flagging workflow...');
  const cr1 = await fetch(`${N8N_URL}/api/v1/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify(workflow1)
  });
  const created1 = await cr1.json();
  if (!created1.id) { console.error('Failed:', JSON.stringify(created1).substring(0, 300)); process.exit(1); }
  console.log('  Created:', created1.id);

  await fetch(`${N8N_URL}/api/v1/workflows/${created1.id}/activate`, {
    method: 'POST', headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  console.log('  Activated');

  // Workflow 2: DAX Compliance Flag Store
  console.log('\nCreating DAX Compliance Flag Store workflow...');
  const cr2 = await fetch(`${N8N_URL}/api/v1/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify(workflow2)
  });
  const created2 = await cr2.json();
  if (!created2.id) { console.error('Failed:', JSON.stringify(created2).substring(0, 300)); process.exit(1); }
  console.log('  Created:', created2.id);

  await fetch(`${N8N_URL}/api/v1/workflows/${created2.id}/activate`, {
    method: 'POST', headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  console.log('  Activated');

  console.log('\nDeployment complete:');
  console.log('  Workflow 1: DAX Compliance Flagging  (ID: ' + created1.id + ')');
  console.log('    POST /webhook/compliance-flag-check');
  console.log('  Workflow 2: DAX Compliance Flag Store (ID: ' + created2.id + ')');
  console.log('    POST /webhook/compliance-store-flag');
  console.log('    GET  /webhook/compliance-flags');
  console.log('    POST /webhook/compliance-flag-update');
}

deploy().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
