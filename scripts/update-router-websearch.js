/**
 * Update DAX Router — live market data via Yahoo Finance + HTTP Request node.
 *
 * n8n sandbox blocks require('https') and fetch() in Code nodes, so we use
 * a native HTTP Request node for the Yahoo Finance call.
 *
 * Flow:
 *   Is Schwab? (no) -> Detect Tickers (Code) -> Fetch Quote (HTTP Request)
 *     -> Build Context (Code) -> Azure OpenAI -> Format -> Respond
 *
 * Called by Deploy-WebSearch.ps1 or run standalone:
 *   node scripts/update-router-websearch.js
 */

const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WORKFLOW_ID = '3tniyxZREqfnAbfo';

// ── Node 1: Detect Tickers (Code) ────────────────────────────────────
const DETECT_CODE = `
const routeData = $('Route Input').first().json;
const userText = routeData.userText || '';
const rawMsg = routeData.userMessage?.toString() || '';

const nameMap = {
  'apple': 'AAPL', 'microsoft': 'MSFT', 'google': 'GOOGL', 'amazon': 'AMZN',
  'meta': 'META', 'nvidia': 'NVDA', 'tesla': 'TSLA', 'netflix': 'NFLX',
  'sp500': 'SPY', 's&p 500': 'SPY', 's&p': 'SPY', 'nasdaq': 'QQQ',
  'dow': 'DIA', 'dow jones': 'DIA', 'russell': 'IWM',
  'qqq': 'QQQ', 'spy': 'SPY', 'dia': 'DIA', 'iwm': 'IWM', 'voo': 'VOO',
  'gold': 'GLD', 'silver': 'SLV', 'oil': 'USO', 'bitcoin': 'BTC-USD',
  'vix': '^VIX', 'jpmorgan': 'JPM', 'goldman': 'GS',
  'visa': 'V', 'mastercard': 'MA', 'exxon': 'XOM', 'chevron': 'CVX',
  '10 year': '^TNX', 'treasury': '^TNX'
};

const marketSignals = ['trading at','stock price','share price','price of','price for',
  'how is the market','market today','market doing','stock quote','market price',
  'what is the price','etf price','bond yield','yield today','how much is'];

const isMarket = marketSignals.some(s => userText.includes(s))
  || (/\\b[A-Z]{1,5}\\b/.test(rawMsg)
      && (userText.includes('price') || userText.includes('trading') || userText.includes('quote')));

const mapped = [];
for (const [name, ticker] of Object.entries(nameMap)) {
  if (userText.includes(name)) mapped.push(ticker);
}
const explicit = (rawMsg.match(/\\b[A-Z]{1,5}\\b/g) || [])
  .filter(t => !['I','A','THE','AND','OR','FOR','TO','AT','IS','IT','IN','MY','DO','SO','AM','AS','BE','WE','NO','IF','CAN','HAS','WAS','ARE','NOT','BUT','ALL','ANY','HOW','WHO'].includes(t));
const tickers = [...new Set([...mapped, ...explicit])].slice(0, 5);
const primaryTicker = tickers[0] || 'SPY';

console.log('[DAX] isMarket:', isMarket, '| tickers:', tickers.join(','), '| primary:', primaryTicker);

return [{ json: {
  isMarket,
  tickers,
  primaryTicker,
  fetchUrl: 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(primaryTicker) + '?interval=1d&range=1d',
  originalBody: routeData.originalBody
}}];
`.trim();

// ── Node 2: Fetch Quote (HTTP Request) — added as n8n node in update() ──

// ── Node 3: Build Context (Code) ─────────────────────────────────────
const BUILD_CODE = `
const detect = $('Detect Tickers').first().json;
const quoteRaw = $('Fetch Quote').first().json;
const body = JSON.parse(JSON.stringify(detect.originalBody));

let searchContext = '';

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

    searchContext = '\\n\\n[Live market data as of ~' + ts + ' ET]\\n';
    searchContext += meta.symbol + ' (' + name + '): $' + price.toFixed(2) + ' ' + arrow + ' ' + sign + change.toFixed(2) + ' (' + sign + pct.toFixed(2) + '%)' + state;
    searchContext += '\\n\\nPresent this live data to the advisor clearly. Include price, change, and percentage.';
    console.log('[DAX] Injecting market data:', meta.symbol, '$' + price.toFixed(2));
  } else {
    console.log('[DAX] Yahoo Finance returned no data. Error:', JSON.stringify(quoteRaw?.chart?.error || quoteRaw?.error || 'unknown').substring(0, 200));
    searchContext = '\\n\\n[Market data temporarily unavailable. Let the advisor know and suggest checking their trading platform.]';
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

return [{ json: { enrichedBody: body } }];
`.trim();

async function update() {
  console.log('Fetching workflow...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();
  if (!wf.nodes) {
    console.error('Failed to fetch workflow:', JSON.stringify(wf));
    process.exit(1);
  }
  console.log(`  ${wf.name} — ${wf.nodes.length} nodes`);

  // ── Remove superseded nodes ──────────────────────────────────────
  const removeNames = [
    'Smart Search', 'Bing Web Search', 'Enrich with Search',
    'Prepare Grounded Request', 'Is Market?', 'Call Market Data',
    'Format Market Response', 'Respond Market',
    'Detect Tickers', 'Fetch Quote', 'Build Context'
  ];
  const before = wf.nodes.length;
  wf.nodes = wf.nodes.filter(n => !removeNames.includes(n.name));
  for (const name of removeNames) delete wf.connections[name];
  console.log(`  Removed ${before - wf.nodes.length} old nodes`);

  // ── Add Detect Tickers (Code) ────────────────────────────────────
  wf.nodes.push({
    parameters: { jsCode: DETECT_CODE },
    id: 'detect-tickers-001',
    name: 'Detect Tickers',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1060, 720]
  });
  console.log('  + Detect Tickers');

  // ── Add Fetch Quote (HTTP Request) ───────────────────────────────
  wf.nodes.push({
    parameters: {
      method: 'GET',
      url: "={{ $json.fetchUrl }}",
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'User-Agent', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          { name: 'Accept', value: 'application/json' }
        ]
      },
      options: { timeout: 8000 }
    },
    id: 'fetch-quote-001',
    name: 'Fetch Quote',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [1300, 720],
    continueOnFail: true
  });
  console.log('  + Fetch Quote (HTTP Request)');

  // ── Add Build Context (Code) ─────────────────────────────────────
  wf.nodes.push({
    parameters: { jsCode: BUILD_CODE },
    id: 'build-context-001',
    name: 'Build Context',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1540, 720]
  });
  console.log('  + Build Context');

  // ── Rewire connections ───────────────────────────────────────────
  if (wf.connections['Is Schwab?']?.main?.[1]) {
    wf.connections['Is Schwab?'].main[1] = [
      { node: 'Detect Tickers', type: 'main', index: 0 }
    ];
  }
  wf.connections['Detect Tickers'] = {
    main: [[{ node: 'Fetch Quote', type: 'main', index: 0 }]]
  };
  wf.connections['Fetch Quote'] = {
    main: [[{ node: 'Build Context', type: 'main', index: 0 }]]
  };
  wf.connections['Build Context'] = {
    main: [[{ node: 'Azure OpenAI Passthrough', type: 'main', index: 0 }]]
  };

  // Update Azure OpenAI Passthrough to read from Build Context
  const azureNode = wf.nodes.find(n => n.name === 'Azure OpenAI Passthrough');
  if (azureNode) {
    azureNode.parameters.url = "={{ 'https://oai-dax-dakona-pilot.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-08-01-preview' }}";
    azureNode.parameters.jsonBody = "={{ $('Build Context').first().json.enrichedBody }}";
    console.log('  ~ Azure OpenAI Passthrough -> reads from Build Context');
  }

  // ── Push ─────────────────────────────────────────────────────────
  console.log('\nPushing...');
  const putResp = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings })
  });
  const result = await putResp.json();
  if (!result.id) { console.error('FAILED:', JSON.stringify(result)); process.exit(1); }
  console.log('  Updated:', result.id);

  await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}/activate`, {
    method: 'POST', headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  console.log('  Activated');
  console.log('\nFlow: Is Schwab?(no) -> Detect Tickers -> Fetch Quote -> Build Context -> Azure OpenAI -> Format -> Respond');
}

update().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
