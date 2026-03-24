/**
 * Update DAX Router — add Bing Web Search for non-market general queries.
 *
 * Current flow:
 *   Is Schwab?(no) → Detect Tickers → Fetch Quote → Build Context → Azure OpenAI → Format → Respond
 *
 * New flow:
 *   Is Schwab?(no) → Detect Tickers → Fetch Quote → Bing Web Search → Build Context → Azure OpenAI → Format → Respond
 *
 * Bing Search runs for ALL non-Schwab queries. Build Context merges both:
 * - Market data from Yahoo Finance (if ticker detected)
 * - Web search results from Bing (always, for current knowledge)
 *
 * Run: node scripts/update-router-bing-search.js
 */

const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WORKFLOW_ID = '3tniyxZREqfnAbfo';
const BING_KEY = '1a3bc1549f6b4b979f24d874fd06d9ab';

// Updated Build Context — merges Yahoo Finance market data AND Bing search results
const BUILD_CODE = `
const detect = $('Detect Tickers').first().json;
const quoteRaw = $('Fetch Quote').first().json;
const bingRaw = $('Bing Web Search').first().json;
const body = JSON.parse(JSON.stringify(detect.originalBody));

let searchContext = '';

// ── Market data from Yahoo Finance ──────────────────────────────
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

// ── Web search from Bing ────────────────────────────────────────
const pages = bingRaw?.webPages?.value || [];
const news = bingRaw?.news?.value || [];
if (pages.length > 0 || news.length > 0) {
  searchContext += '\\n\\n[Web search results — use these for current information, cite the source URL when relevant]\\n';
  pages.slice(0, 5).forEach((r, i) => {
    searchContext += '[' + (i+1) + '] ' + r.name + '\\n' + r.snippet + '\\nSource: ' + r.url + '\\n\\n';
  });
  news.slice(0, 3).forEach((r) => {
    searchContext += '[News] ' + r.name + ' (' + (r.datePublished?.split('T')[0] || 'recent') + ')\\n' + r.description + '\\nSource: ' + r.url + '\\n\\n';
  });
  console.log('[DAX] Bing results:', pages.length, 'pages,', news.length, 'news');
} else {
  console.log('[DAX] No Bing results');
}

// ── Inject into messages ────────────────────────────────────────
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
  console.log('Fetching DAX Router...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();
  console.log(`  ${wf.name} — ${wf.nodes.length} nodes`);

  // ── Add Bing Web Search node (between Fetch Quote and Build Context) ──
  // Remove old Bing node if it exists
  wf.nodes = wf.nodes.filter(n => n.name !== 'Bing Web Search');
  delete wf.connections['Bing Web Search'];

  wf.nodes.push({
    parameters: {
      method: 'GET',
      url: "=https://api.bing.microsoft.com/v7.0/search?q={{ encodeURIComponent($('Detect Tickers').first().json.userText || $('Route Input').first().json.userText || '') }}&count=5&responseFilter=Webpages,News&mkt=en-US",
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Ocp-Apim-Subscription-Key', value: BING_KEY }
        ]
      },
      options: { timeout: 5000 }
    },
    id: 'bing-search-002',
    name: 'Bing Web Search',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [1420, 720],
    continueOnFail: true
  });
  console.log('  + Bing Web Search');

  // ── Update Build Context code ──
  const buildNode = wf.nodes.find(n => n.name === 'Build Context');
  buildNode.parameters.jsCode = BUILD_CODE;
  // Move Build Context position right to make room
  buildNode.position = [1660, 720];
  console.log('  ~ Build Context: now merges Yahoo + Bing');

  // ── Rewire: Fetch Quote → Bing Web Search → Build Context ──
  wf.connections['Fetch Quote'] = {
    main: [[{ node: 'Bing Web Search', type: 'main', index: 0 }]]
  };
  wf.connections['Bing Web Search'] = {
    main: [[{ node: 'Build Context', type: 'main', index: 0 }]]
  };
  // Build Context → Azure OpenAI already wired
  console.log('  Rewired: Fetch Quote → Bing → Build Context → Azure OpenAI');

  // ── Also need to pass userText through Detect Tickers ──
  // Check if Detect Tickers already passes userText
  const detectNode = wf.nodes.find(n => n.name === 'Detect Tickers');
  if (detectNode && !detectNode.parameters.jsCode.includes('userText')) {
    // Add userText to the output
    detectNode.parameters.jsCode = detectNode.parameters.jsCode.replace(
      'originalBody: routeData.originalBody',
      'originalBody: routeData.originalBody,\n  userText: routeData.userText || userText'
    );
    console.log('  ~ Detect Tickers: added userText to output');
  }

  // ── Push ──
  console.log('\nPushing...');
  const putResp = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings })
  });
  const result = await putResp.json();
  if (!result.id) { console.error('FAILED:', JSON.stringify(result).substring(0, 500)); process.exit(1); }
  console.log('  Updated:', result.id);

  await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}/activate`, {
    method: 'POST', headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  console.log('  Activated');
  console.log('\nFlow: Is Schwab?(no) → Detect Tickers → Fetch Quote → Bing Web Search → Build Context → Azure OpenAI → Format → Respond');
}

update().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
