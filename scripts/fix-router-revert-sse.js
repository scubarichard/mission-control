/**
 * URGENT — Revert DAX Router response to SSE format.
 * LibreChat's agents controller expects text/event-stream, not JSON.
 * Run: node scripts/fix-router-revert-sse.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '3tniyxZREqfnAbfo';

// SSE format that the agents controller expects
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

const c1 = JSON.stringify({ id, object: 'chat.completion.chunk', created: now, model: 'gpt-4o', choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] });
const c2 = JSON.stringify({ id, object: 'chat.completion.chunk', created: now, model: 'gpt-4o', choices: [{ index: 0, delta: { content }, finish_reason: null }] });
const c3 = JSON.stringify({ id, object: 'chat.completion.chunk', created: now, model: 'gpt-4o', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
const sseBody = 'data: ' + c1 + '\\n\\ndata: ' + c2 + '\\n\\ndata: ' + c3 + '\\n\\ndata: [DONE]\\n\\n';

return [{ json: { sseBody } }];
`.trim();

const SCHWAB_FORMAT = `
const result = $('Call Schwab Processor').first().json;
const summary = result.summary || 'Reports generated';
const results = result.results || [];
const links = results.filter(r => r.webUrl).map(r => '- [' + r.clientName + '](' + r.webUrl + ')').join('\\n');
const content = '\\u2705 **' + summary + '**\\n\\n' + links;
const now = Math.floor(Date.now() / 1000);
const id = 'chatcmpl-dax-' + now;

const c1 = JSON.stringify({ id, object: 'chat.completion.chunk', created: now, model: 'gpt-4o', choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] });
const c2 = JSON.stringify({ id, object: 'chat.completion.chunk', created: now, model: 'gpt-4o', choices: [{ index: 0, delta: { content }, finish_reason: null }] });
const c3 = JSON.stringify({ id, object: 'chat.completion.chunk', created: now, model: 'gpt-4o', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
const sseBody = 'data: ' + c1 + '\\n\\ndata: ' + c2 + '\\n\\ndata: ' + c3 + '\\n\\ndata: [DONE]\\n\\n';

return [{ json: { sseBody } }];
`.trim();

async function update() {
  console.log('Fetching...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();

  // Revert Format General Response to SSE
  const formatNode = wf.nodes.find(n => n.name === 'Format General Response');
  formatNode.parameters.jsCode = FORMAT_CODE;
  console.log('  Reverted Format General → SSE');

  // Revert Respond General to SSE
  const respondNode = wf.nodes.find(n => n.name === 'Respond General');
  respondNode.parameters = {
    respondWith: 'text',
    responseBody: '={{ $json.sseBody }}',
    options: {
      responseCode: 200,
      responseHeaders: {
        entries: [
          { name: 'Content-Type', value: 'text/event-stream' },
          { name: 'Cache-Control', value: 'no-cache' },
          { name: 'Connection', value: 'keep-alive' },
          { name: 'Access-Control-Allow-Origin', value: '*' }
        ]
      }
    }
  };
  console.log('  Reverted Respond General → text/event-stream');

  // Fix Format Schwab Response to SSE too
  const schwabFormat = wf.nodes.find(n => n.name === 'Format Schwab Response');
  schwabFormat.parameters.jsCode = SCHWAB_FORMAT;

  const schwabRespond = wf.nodes.find(n => n.name === 'Respond Schwab');
  schwabRespond.parameters = {
    respondWith: 'text',
    responseBody: '={{ $json.sseBody }}',
    options: {
      responseCode: 200,
      responseHeaders: {
        entries: [
          { name: 'Content-Type', value: 'text/event-stream' },
          { name: 'Cache-Control', value: 'no-cache' },
          { name: 'Connection', value: 'keep-alive' },
          { name: 'Access-Control-Allow-Origin', value: '*' }
        ]
      }
    }
  };
  console.log('  Reverted Schwab → SSE');

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
