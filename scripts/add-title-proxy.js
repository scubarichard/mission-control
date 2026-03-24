/**
 * Add title request detection to DAX Router.
 * Title requests proxy directly to Azure OpenAI (via VNet private endpoint)
 * and return JSON, bypassing the agent + SSE.
 *
 * Run: node scripts/add-title-proxy.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '3tniyxZREqfnAbfo';
const AZURE_KEY = '635645200b2c4f90a183bf3bd3d5c291';

// New Extract Message code — detects title requests and proxies them
const EXTRACT_CODE = `var body = $json.body || $json;
var messages = body.messages || [];
var lastUser = null;
for (var i = messages.length - 1; i >= 0; i--) {
  if (messages[i] && messages[i].role === "user") { lastUser = messages[i]; break; }
}
var userText = "";
if (lastUser) {
  userText = typeof lastUser.content === "string" ? lastUser.content : "";
}

// Detect title generation requests
var isTitle = userText.toLowerCase().indexOf("title for the conversation") >= 0 || userText.toLowerCase().indexOf("concise title") >= 0 || userText.toLowerCase().indexOf("5-word") >= 0;

return [{ json: { userText: userText, isTitle: isTitle, originalMessages: messages, originalBody: body } }];`;

// Title Proxy node — calls Azure OpenAI directly and returns JSON
const TITLE_PROXY_CODE = `var https = require("https");
var input = $input.all()[0].json;
var body = input.originalBody || {};

// Forward to Azure OpenAI
var reqBody = JSON.stringify({
  messages: body.messages || [{ role: "user", content: input.userText }],
  max_tokens: 50,
  temperature: 0.7
});

var result = await new Promise(function(resolve) {
  var req = https.request({
    hostname: "oai-dax-dakona-pilot.openai.azure.com",
    path: "/openai/deployments/gpt-4o/chat/completions?api-version=2024-08-01-preview",
    method: "POST",
    headers: {
      "api-key": "${AZURE_KEY}",
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(reqBody)
    }
  }, function(res) {
    var data = "";
    res.on("data", function(c) { data += c; });
    res.on("end", function() { resolve(data); });
  });
  req.on("error", function(e) { resolve(JSON.stringify({ error: e.message })); });
  req.write(reqBody);
  req.end();
});

// Return as JSON response (not SSE)
var parsed = {};
try { parsed = JSON.parse(result); } catch(e) { parsed = { choices: [{ message: { role: "assistant", content: "New Chat" } }] }; }

return [{ json: { jsonResponse: parsed } }];`;

// JSON Respond node for title
const TITLE_RESPOND_PARAMS = {
  respondWith: 'json',
  responseBody: '={{ $json.jsonResponse }}',
  options: {
    responseCode: 200,
    responseHeaders: {
      entries: [
        { name: 'Access-Control-Allow-Origin', value: '*' }
      ]
    }
  }
};

async function deploy() {
  console.log('Fetching router...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();

  // Update Extract Message to detect title requests
  const extract = wf.nodes.find(n => n.name === 'Extract Message');
  extract.parameters.jsCode = EXTRACT_CODE;
  console.log('  Updated Extract Message with title detection');

  // Add If Title node (routes title vs normal)
  wf.nodes.push({
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 1 },
        conditions: [{
          leftValue: '={{ $json.isTitle }}',
          rightValue: true,
          operator: { type: 'boolean', operation: 'equals' },
          id: 'title-check-001'
        }],
        combinator: 'and'
      },
      options: {}
    },
    id: 'if-title-001',
    name: 'Is Title?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2,
    position: [620, 300]
  });
  console.log('  Added Is Title? router');

  // Add Title Proxy node
  wf.nodes.push({
    parameters: { jsCode: TITLE_PROXY_CODE },
    id: 'title-proxy-001',
    name: 'Title Proxy',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [860, 160]
  });
  console.log('  Added Title Proxy (Azure OpenAI direct)');

  // Add Title Respond node
  wf.nodes.push({
    parameters: TITLE_RESPOND_PARAMS,
    id: 'title-respond-001',
    name: 'Respond Title',
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.1,
    position: [1100, 160]
  });
  console.log('  Added Respond Title (JSON)');

  // Rewire: Extract Message → Is Title?
  //   Is Title? true → Title Proxy → Respond Title
  //   Is Title? false → DAX Agent (existing flow)
  wf.connections['Extract Message'] = {
    main: [[{ node: 'Is Title?', type: 'main', index: 0 }]]
  };
  wf.connections['Is Title?'] = {
    main: [
      [{ node: 'Title Proxy', type: 'main', index: 0 }],   // true
      [{ node: 'DAX Agent', type: 'main', index: 0 }]       // false
    ]
  };
  wf.connections['Title Proxy'] = {
    main: [[{ node: 'Respond Title', type: 'main', index: 0 }]]
  };
  console.log('  Rewired: Extract → Is Title? → (true: Proxy, false: Agent)');

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
  console.log('  Activated. Title requests → Azure OpenAI (JSON), normal → Agent (SSE)');
}

deploy().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
