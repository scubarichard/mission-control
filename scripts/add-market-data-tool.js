/**
 * Add get_market_data tool to the AI Agent + create Market Data workflow.
 * Run: node scripts/add-market-data-tool.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const ROUTER_WF_ID = '3tniyxZREqfnAbfo';

// ── Step 1: Create the Market Data workflow ──────────────────────────

const MARKET_CODE = `
const body = $json.body || $json;
const symbols = (body.symbols || 'SPY').split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 10);
console.log('[Market] Fetching:', symbols.join(', '));

const https = require('https');
function fetchChart(symbol) {
  return new Promise((resolve) => {
    const url = '/v8/finance/chart/' + encodeURIComponent(symbol) + '?interval=1d&range=1d';
    https.get({
      hostname: 'query1.finance.yahoo.com', path: url, method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          const meta = j?.chart?.result?.[0]?.meta;
          if (!meta) { resolve({ symbol, error: 'No data' }); return; }
          const price = meta.regularMarketPrice;
          const prev = meta.chartPreviousClose || meta.previousClose;
          const change = prev ? (price - prev) : 0;
          const pct = prev ? ((change / prev) * 100) : 0;
          const name = meta.shortName || meta.longName || symbol;
          const isRate = ['^IRX', '^TNX', '^FVX', '^TYX'].includes(symbol);
          resolve({
            symbol, name,
            price: isRate ? price.toFixed(3) + '%' : '$' + price.toFixed(2),
            change: (change >= 0 ? '+' : '') + (isRate ? change.toFixed(3) : change.toFixed(2)),
            changePct: (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%',
            marketState: meta.marketState || ''
          });
        } catch(e) { resolve({ symbol, error: e.message }); }
      });
      res.on('error', () => resolve({ symbol, error: 'fetch failed' }));
    }).on('error', () => resolve({ symbol, error: 'connection failed' }));
  });
}

const results = await Promise.all(symbols.map(s => fetchChart(s)));

const formatted = results.map(r =>
  r.error ? r.symbol + ': ' + r.error :
  r.symbol + ' (' + r.name + '): ' + r.price + ' ' + r.changePct + ' today'
).join('\\n');

const now = Math.floor(Date.now() / 1000);
const id = 'chatcmpl-dax-' + now;
const responseBody = { response: formatted, data: results };

return [{ json: responseBody }];
`.trim();

const marketWorkflow = {
  name: 'DAX Market Data',
  nodes: [
    {
      parameters: { httpMethod: 'POST', path: 'market-data', responseMode: 'responseNode', options: {} },
      id: 'mkt-webhook-001',
      name: 'Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [220, 300]
    },
    {
      parameters: { jsCode: MARKET_CODE },
      id: 'mkt-fetch-001',
      name: 'Fetch Prices',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [460, 300]
    },
    {
      parameters: { respondWith: 'json', responseBody: '={{ $json }}', options: { responseCode: 200 } },
      id: 'mkt-respond-001',
      name: 'Respond',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.1,
      position: [700, 300]
    }
  ],
  connections: {
    'Webhook': { main: [[{ node: 'Fetch Prices', type: 'main', index: 0 }]] },
    'Fetch Prices': { main: [[{ node: 'Respond', type: 'main', index: 0 }]] }
  },
  settings: { executionOrder: 'v1' }
};

// ── Step 2: Add the tool to the Router Agent ─────────────────────────

async function deploy() {
  // Create Market Data workflow
  console.log('Creating DAX Market Data workflow...');
  const createResp = await fetch(`${N8N_URL}/api/v1/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify(marketWorkflow)
  });
  const created = await createResp.json();
  if (!created.id) { console.error('Failed to create:', JSON.stringify(created).substring(0, 300)); process.exit(1); }
  console.log('  Created:', created.id);

  // Activate it
  await fetch(`${N8N_URL}/api/v1/workflows/${created.id}/activate`, {
    method: 'POST', headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  console.log('  Activated');

  // Now add the tool to the Router Agent
  console.log('\nAdding market data tool to AI Agent...');
  const routerResp = await fetch(`${N8N_URL}/api/v1/workflows/${ROUTER_WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const router = await routerResp.json();

  // Add Market Data Tool node
  router.nodes.push({
    parameters: {
      name: 'get_market_data',
      description: 'Fetches current stock prices, ETF prices, index levels, treasury yields, commodity prices, or crypto prices from Yahoo Finance. Use when an advisor asks about current prices, how the market is doing, how a stock or ETF is performing, treasury yields, the fed funds rate, gold/oil prices, or wants to compare holdings. Pass ticker symbols like SPY, AAPL, ^TNX (10yr yield), ^IRX (fed funds proxy), GC=F (gold), CL=F (oil), BTC-USD (bitcoin).',
      url: 'https://n8n.dakona.net/webhook/market-data',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={"symbols":"{{ $fromAI(\'symbols\', \'Comma-separated ticker symbols, e.g. SPY,AAPL,NVDA or ^TNX for 10yr yield\') }}"}',
      method: 'POST',
      placeholderDefinitions: { values: [] }
    },
    id: 'tool-market-001',
    name: 'Market Data Tool',
    type: '@n8n/n8n-nodes-langchain.toolHttpRequest',
    typeVersion: 1.1,
    position: [1300, 520]
  });

  // Add connection: Market Data Tool → DAX Agent (ai_tool)
  router.connections['Market Data Tool'] = {
    ai_tool: [[{ node: 'DAX Agent', type: 'ai_tool', index: 0 }]]
  };

  // Push
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
  console.log('\n  Agent now has 3 tools: generate_quarterly_reports, get_client_info, get_market_data');
}

deploy().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
