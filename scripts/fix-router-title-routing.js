/**
 * Fix DAX Router — detect title generation requests + fix Schwab format syntax.
 * Run: node scripts/fix-router-title-routing.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '3tniyxZREqfnAbfo';

const SCHWAB_FORMAT = `
const result = $('Call Schwab Processor').first().json;
const summary = result.summary || 'Reports generated';
const results = result.results || [];
const links = results.filter(r => r.webUrl).map(r => '- [' + r.clientName + '](' + r.webUrl + ')').join('\\n');
const content = '\\u2705 **' + summary + '**\\n\\n' + links;
const now = Math.floor(Date.now() / 1000);
const jsonBody = {
  id: 'chatcmpl-dax-' + now,
  object: 'chat.completion',
  created: now,
  model: 'gpt-4o',
  choices: [{ index: 0, message: { role: 'assistant', content: content }, finish_reason: 'stop' }],
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

  // Fix 1: Route Input — detect title generation and force GENERAL
  const routeInput = wf.nodes.find(n => n.name === 'Route Input');
  let routeCode = routeInput.parameters.jsCode;

  // Add title detection before the route assignment
  routeCode = routeCode.replace(
    "let route = 'GENERAL';",
    "// Detect title generation requests from LibreChat\n" +
    "const isTitle = userTextLower.includes('title for the conversation') || userTextLower.includes('concise title') || userTextLower.includes('5-word');\n" +
    "let route = 'GENERAL';"
  );
  // Add isTitle check to bypass Schwab/ICP routing
  routeCode = routeCode.replace(
    "if (isSchwab) route = 'SCHWAB';",
    "if (isTitle) route = 'GENERAL';\nelse if (isSchwab) route = 'SCHWAB';"
  );
  routeInput.parameters.jsCode = routeCode;
  console.log('  Fixed Route Input: title detection bypasses Schwab');

  // Fix 2: Format Schwab Response — clean JSON format
  const schwabFormat = wf.nodes.find(n => n.name === 'Format Schwab Response');
  schwabFormat.parameters.jsCode = SCHWAB_FORMAT;
  console.log('  Fixed Format Schwab Response: clean JSON');

  // Push
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
