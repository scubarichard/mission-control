/**
 * Fix Build Context — add Bing Grounding data_sources to Azure OpenAI request.
 * Run: node scripts/fix-build-context-bing.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WORKFLOW_ID = '3tniyxZREqfnAbfo';
const BING_KEY = '1a3bc1549f6b4b979f24d874fd06d9ab';

const BUILD_CODE = `
const detect = $('Detect Tickers').first().json;
const quoteRaw = $('Fetch Quote').first().json;
const body = JSON.parse(JSON.stringify(detect.originalBody));

let searchContext = '';

// Market data from Yahoo Finance
if (detect.isMarket && detect.tickers.length > 0) {
  const meta = quoteRaw?.chart?.result?.[0]?.meta;
  if (meta) {
    const price = meta.regularMarketPrice;
    const prev = meta.chartPreviousClose || meta.previousClose;
    const change = prev ? (price - prev) : 0;
    const pct = prev ? ((change / prev) * 100) : 0;
    const arrow = change >= 0 ? '\\u25B2' : '\\u25BC';
    const sign = change >= 0 ? '+' : '';
    const name = meta.shortName || meta.longName || meta.symbol;
    const state = meta.marketState === 'PRE' ? ' (pre-market)' : meta.marketState === 'POST' ? ' (after-hours)' : '';
    const ts = new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' });
    searchContext += '\\n\\n[Live market data as of ~' + ts + ' ET]\\n';
    searchContext += meta.symbol + ' (' + name + '): $' + price.toFixed(2) + ' ' + arrow + ' ' + sign + change.toFixed(2) + ' (' + sign + pct.toFixed(2) + '%)' + state;
    searchContext += '\\nPresent this live data clearly. Include price, change, and percentage.';
    console.log('[DAX] Market data:', meta.symbol, '$' + price.toFixed(2));
  }
}

const messages = [...(body.messages || [])];
if (searchContext) {
  const si = messages.findIndex(m => m.role === 'system');
  if (si >= 0) {
    messages[si] = { ...messages[si], content: messages[si].content + searchContext };
  } else {
    messages.unshift({ role: 'system', content: 'You are DAX, an AI assistant for RIAs.' + searchContext });
  }
}
body.messages = messages;
delete body.stream;
body.stream = false;

// Bing Grounding — Azure OpenAI searches the web natively
body.data_sources = [{
  type: 'bing_grounding',
  parameters: {
    connection: { api_key: '${BING_KEY}' }
  }
}];
console.log('[DAX] Bing Grounding attached to request');

return [{ json: { enrichedBody: body } }];
`.trim();

async function update() {
  console.log('Fetching...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();

  const buildNode = wf.nodes.find(n => n.name === 'Build Context');
  buildNode.parameters.jsCode = BUILD_CODE;
  console.log('Updated Build Context');

  const putResp = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings })
  });
  const result = await putResp.json();
  if (!result.id) { console.error('FAILED:', JSON.stringify(result).substring(0, 500)); process.exit(1); }
  await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}/activate`, {
    method: 'POST', headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  console.log('Activated');
}

update().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
