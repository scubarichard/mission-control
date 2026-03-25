/**
 * Fix get_market_summary: create webhook workflow + wire HTTP Request tool to Agent.
 * The previous toolCode approach failed because the node wasn't connected.
 * This approach: separate workflow with webhook + toolHttpRequest in the Agent.
 *
 * Run: node scripts/fix-market-summary-tool.js
 */
const N8N_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '3tniyxZREqfnAbfo';

const SUMMARY_CODE = [
  'const FMP_KEY = $env.FMP_API_KEY || "";',
  'const FINNHUB_KEY = $env.FINNHUB_API_KEY || "";',
  '',
  'let headlines = [];',
  '',
  '// Primary — Finnhub (confirmed working on free tier)',
  'if (FINNHUB_KEY) {',
  '  try {',
  '    const r = await $http.request({ method: "GET", url: "https://finnhub.io/api/v1/news?category=general&token=" + FINNHUB_KEY });',
  '    headlines = (r || []).slice(0, 8).map(function(n) {',
  '      return {',
  '        title: n.headline || "",',
  '        summary: (n.summary || "").substring(0, 150),',
  '        source: n.source || "Unknown",',
  '        published: n.datetime ? new Date(n.datetime * 1000).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : "",',
  '        symbol: n.related || ""',
  '      };',
  '    });',
  '  } catch(e) { console.log("Finnhub failed:", e.message); }',
  '}',
  '',
  '// Key index prices from FMP stable API',
  'let snapshot = "";',
  'if (FMP_KEY) {',
  '  try {',
  '    const symbols = ["SPY", "QQQ", "IWM", "TLT"];',
  '    const prices = [];',
  '    for (const sym of symbols) {',
  '      try {',
  '        const r = await $http.request({ method: "GET", url: "https://financialmodelingprep.com/stable/quote?symbol=" + sym + "&apikey=" + FMP_KEY });',
  '        if (r && Array.isArray(r) && r.length > 0) prices.push(r[0]);',
  '      } catch(e) {}',
  '    }',
  '    snapshot = prices.map(function(q) {',
  '      var pct = q.changesPercentage || 0;',
  '      return q.symbol + ": $" + (q.price || 0).toFixed(2) + " (" + (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%)";',
  '    }).join(" | ");',
  '  } catch(e) {}',
  '}',
  '',
  '// Fallback prices from Yahoo Finance',
  'if (!snapshot) {',
  '  try {',
  '    const r = await $http.request({ method: "GET", url: "https://query1.finance.yahoo.com/v8/finance/chart/SPY?range=1d&interval=1d" });',
  '    if (r && r.chart && r.chart.result) {',
  '      var meta = r.chart.result[0].meta;',
  '      var price = meta.regularMarketPrice || 0;',
  '      var prev = meta.chartPreviousClose || 0;',
  '      var change = prev > 0 ? ((price - prev) / prev * 100) : 0;',
  '      snapshot = "SPY: $" + price.toFixed(2) + " (" + (change >= 0 ? "+" : "") + change.toFixed(2) + "%)";',
  '    }',
  '  } catch(e) {}',
  '}',
  '',
  'const today = new Date().toLocaleDateString("en-US", {',
  '  timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric", year: "numeric"',
  '});',
  '',
  'const headlineText = headlines.length > 0',
  '  ? headlines.map(function(h, i) {',
  '      return (i+1) + ". **" + h.title + "**" + (h.symbol ? " (" + h.symbol + ")" : "") +',
  '        "\\n   " + (h.summary || "") + "..." +',
  '        "\\n   " + h.source + " | " + h.published;',
  '    }).join("\\n\\n")',
  '  : "No market news available right now.";',
  '',
  'const response = "MARKET SUMMARY — " + today + "\\n\\n" +',
  '  "KEY INDICES\\n" + (snapshot || "Price data unavailable") + "\\n\\n" +',
  '  "TOP MARKET STORIES\\n" + headlineText + "\\n\\n" +',
  '  "Source: FMP/Finnhub live data | Note: For investment decisions, verify with primary sources.";',
  '',
  'return [{ json: { response: response } }];',
].join('\n');

async function main() {
  // ── Step 1: Create DAX Market Summary webhook workflow ──────────────
  console.log('Creating DAX Market Summary workflow...');

  const wfBody = {
    name: 'DAX Market Summary',
    nodes: [
      {
        id: 'wh-' + Date.now(),
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2,
        position: [260, 340],
        webhookId: 'get-market-summary',
        parameters: {
          httpMethod: 'POST',
          path: 'get-market-summary',
          responseMode: 'responseNode',
          options: {}
        }
      },
      {
        id: 'code-' + Date.now(),
        name: 'Fetch Market Data',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [480, 340],
        parameters: { jsCode: SUMMARY_CODE }
      },
      {
        id: 'resp-' + Date.now(),
        name: 'Respond',
        type: 'n8n-nodes-base.respondToWebhook',
        typeVersion: 1.1,
        position: [700, 340],
        parameters: {
          respondWith: 'json',
          responseBody: '={{ $json }}',
          options: { responseCode: 200 }
        }
      }
    ],
    connections: {
      'Webhook': { main: [[{ node: 'Fetch Market Data', type: 'main', index: 0 }]] },
      'Fetch Market Data': { main: [[{ node: 'Respond', type: 'main', index: 0 }]] }
    },
    settings: { executionOrder: 'v1' }
  };

  const createResp = await fetch(N8N_URL + '/api/v1/workflows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify(wfBody)
  });
  const created = await createResp.json();
  if (!created.id) {
    console.error('Failed to create:', JSON.stringify(created).substring(0, 300));
    process.exit(1);
  }
  console.log('  Created:', created.id);

  await fetch(N8N_URL + '/api/v1/workflows/' + created.id + '/activate', {
    method: 'POST', headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  console.log('  Activated');

  // ── Step 2: Update DAX Router — replace toolCode with toolHttpRequest ──
  console.log('\nUpdating DAX Router...');
  const routerResp = await fetch(N8N_URL + '/api/v1/workflows/' + WF_ID, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const router = await routerResp.json();

  // Remove old Market Summary Tool (toolCode, unconnected)
  const oldIdx = router.nodes.findIndex(n => n.name === 'Market Summary Tool');
  if (oldIdx >= 0) {
    router.nodes.splice(oldIdx, 1);
    delete router.connections['Market Summary Tool'];
    console.log('  Removed old toolCode node');
  }

  // Add new HTTP Request tool
  router.nodes.push({
    id: 'mst-http-' + Date.now(),
    name: 'Market Summary Tool',
    type: '@n8n/n8n-nodes-langchain.toolHttpRequest',
    typeVersion: 1.1,
    position: [2096, 820],
    parameters: {
      name: 'get_market_summary',
      description: "Gets today's real market news and index prices. ALWAYS use this tool when asked about what is driving markets, market news, market update, what's happening in markets, or any request for market context. NEVER answer market commentary questions from general knowledge — always call this tool first.",
      method: 'POST',
      url: 'http://localhost:5678/webhook/get-market-summary',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '{}',
      placeholderDefinitions: { values: [] },
      optimizeResponse: true,
      responsePropertyName: 'response'
    }
  });

  // Wire to DAX Agent (ai_tool)
  router.connections['Market Summary Tool'] = {
    ai_tool: [[{ node: 'DAX Agent', type: 'ai_tool', index: 0 }]]
  };
  console.log('  Added HTTP Request tool + wired to Agent');

  // Update system prompt
  const agent = router.nodes.find(n => n.name === 'DAX Agent');
  if (agent) {
    let sp = agent.parameters.options.systemMessage || '';
    const marketBlock = 'CRITICAL — MARKET COMMENTARY:\nNEVER generate market analysis or commentary from general knowledge.\n"What is driving markets?" → ALWAYS call get_market_summary\n"Any market news?" → ALWAYS call get_market_summary\nIf the tool returns no data → say "I don\'t have current market news available right now"\nNEVER say things like "the Fed is watching inflation" without calling the tool first.';

    if (sp.indexOf('CRITICAL — MARKET COMMENTARY') < 0) {
      if (sp.indexOf('MARKET DATA') >= 0) {
        sp = sp.replace(/MARKET DATA[^]*?(?=\n\n[A-Z]|$)/m, marketBlock);
      } else {
        sp += '\n\n' + marketBlock;
      }
      agent.parameters.options.systemMessage = sp;
      console.log('  Updated system prompt');
    }
  }

  // Push
  const pushResp = await fetch(N8N_URL + '/api/v1/workflows/' + WF_ID, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify({ name: router.name, nodes: router.nodes, connections: router.connections, settings: router.settings })
  });
  const result = await pushResp.json();
  if (!result.id) {
    console.error('Failed:', JSON.stringify(result).substring(0, 300));
    process.exit(1);
  }

  await fetch(N8N_URL + '/api/v1/workflows/' + WF_ID + '/activate', {
    method: 'POST', headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  console.log('  Router activated');

  // Verify
  const verResp = await fetch(N8N_URL + '/api/v1/workflows/' + WF_ID, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const ver = await verResp.json();
  const tools = [];
  for (const [src, conns] of Object.entries(ver.connections)) {
    if (conns.ai_tool) {
      for (const outputs of conns.ai_tool) {
        for (const c of outputs) {
          if (c.node === 'DAX Agent') tools.push(src);
        }
      }
    }
  }
  console.log('\n  Tools connected to Agent:', tools.join(', '));
  console.log('\nDone');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
