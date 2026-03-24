/**
 * Fix DAX Router — return JSON instead of SSE.
 * LibreChat sends stream:false, so response should be standard JSON.
 * Run: node scripts/fix-router-json-response.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '3tniyxZREqfnAbfo';

const FORMAT_CODE = `
const oaiResp = $('Azure OpenAI Passthrough').first().json;
let content;
if (oaiResp?.error) {
  console.log('[DAX] Azure error:', JSON.stringify(oaiResp.error).substring(0, 200));
  content = 'I ran into a temporary issue. Please try again in a moment.';
} else {
  content = oaiResp?.choices?.[0]?.message?.content || 'I am DAX, your AI assistant.';
}
const now = Math.floor(Date.now() / 1000);
const id = 'chatcmpl-dax-' + now;

// Standard OpenAI JSON response (not SSE)
const jsonBody = {
  id: id,
  object: 'chat.completion',
  created: now,
  model: 'gpt-4o',
  choices: [{
    index: 0,
    message: { role: 'assistant', content: content },
    finish_reason: 'stop'
  }],
  usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
};

return [{ json: { responseBody: jsonBody } }];
`.trim();

async function update() {
  console.log('Fetching...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();

  // Update Format General Response
  const formatNode = wf.nodes.find(n => n.name === 'Format General Response');
  formatNode.parameters.jsCode = FORMAT_CODE;
  console.log('  Updated Format General Response → JSON');

  // Update Respond General — return JSON instead of SSE
  const respondNode = wf.nodes.find(n => n.name === 'Respond General');
  respondNode.parameters = {
    respondWith: 'json',
    responseBody: '={{ $json.responseBody }}',
    options: {
      responseCode: 200,
      responseHeaders: {
        entries: [
          { name: 'Access-Control-Allow-Origin', value: '*' }
        ]
      }
    }
  };
  console.log('  Updated Respond General → application/json');

  const putResp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings })
  });
  const result = await putResp.json();
  if (!result.id) { console.error('FAILED:', JSON.stringify(result).substring(0, 500)); process.exit(1); }
  await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}/activate`, {
    method: 'POST', headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  console.log('  Activated');
}

update().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
