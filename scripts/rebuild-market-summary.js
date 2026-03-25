/**
 * Rebuild DAX Market Summary workflow using native HTTP Request nodes.
 * The task runner sandbox blocks process.env, $env, $http, require, and fetch.
 * Solution: use n8n HTTP Request nodes for API calls, Code node only for formatting.
 *
 * Run: node scripts/rebuild-market-summary.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
// WF_ID set after creation
let WF_ID = '';
const FMP_KEY = 'd65SRP1CgzVzaMfhwEniVWMLF7pWNwIn';
const FINNHUB_KEY = 'd7223bpr01qjeeefjd60d7223bpr01qjeeefjd6g';

// Format code — ONLY data transformation, zero I/O
const FORMAT_CODE = `
// Collect all input items
var allItems = $input.all();
var newsItems = [];
var quoteItems = [];

for (var i = 0; i < allItems.length; i++) {
  var j = allItems[i].json;
  // Finnhub news items have 'headline' field
  if (j.headline) newsItems.push(j);
  // FMP quote items have 'symbol' and 'price' fields
  if (j.symbol && j.price !== undefined) quoteItems.push(j);
}

var headlines = newsItems.slice(0, 8).map(function(n) {
  return {
    title: n.headline || "",
    summary: (n.summary || "").substring(0, 150),
    source: n.source || "Unknown",
    published: n.datetime
      ? new Date(n.datetime * 1000).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
      : "",
    symbol: n.related || ""
  };
});

var snapshot = quoteItems.map(function(q) {
  var pct = q.changesPercentage || 0;
  return q.symbol + ": $" + (q.price || 0).toFixed(2) + " (" + (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%)";
}).join(" | ");

var today = new Date().toLocaleDateString("en-US", {
  timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric", year: "numeric"
});

var headlineText = headlines.length > 0
  ? headlines.map(function(h, i) {
      return (i+1) + ". **" + h.title + "**" + (h.symbol ? " (" + h.symbol + ")" : "") +
        "\\n   " + (h.summary || "") +
        "\\n   " + h.source + " | " + h.published;
    }).join("\\n\\n")
  : "No market news available right now.";

var response = "MARKET SUMMARY — " + today + "\\n\\n" +
  "KEY INDICES\\n" + (snapshot || "Price data unavailable") + "\\n\\n" +
  "TOP MARKET STORIES\\n" + headlineText + "\\n\\n" +
  "Source: FMP/Finnhub live data | Note: For investment decisions, verify with primary sources.";

return [{ json: { response: response } }];
`.trim();

async function main() {
  console.log('Creating DAX Market Summary workflow (fresh)...');

  const wf = {
    name: 'DAX Market Summary',
    settings: { executionOrder: 'v1' }
  };

  wf.nodes = [
    {
      id: 'wh-1', name: 'Webhook',
      type: 'n8n-nodes-base.webhook', typeVersion: 2,
      position: [260, 340],
      parameters: { httpMethod: 'POST', path: 'get-market-summary', responseMode: 'responseNode', options: {} }
    },
    {
      id: 'news-1', name: 'Fetch Finnhub News',
      type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
      position: [500, 200],
      parameters: {
        method: 'GET',
        url: 'https://finnhub.io/api/v1/news?category=general&token=' + FINNHUB_KEY,
        options: { timeout: 10000, response: { response: { neverError: true } } }
      }
    },
    {
      id: 'quotes-spy', name: 'Fetch SPY Quote',
      type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
      position: [500, 400],
      parameters: {
        method: 'GET',
        url: 'https://financialmodelingprep.com/stable/quote?symbol=SPY&apikey=' + FMP_KEY,
        options: { timeout: 10000, response: { response: { neverError: true } } }
      }
    },
    {
      id: 'quotes-qqq', name: 'Fetch QQQ Quote',
      type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
      position: [500, 520],
      parameters: {
        method: 'GET',
        url: 'https://financialmodelingprep.com/stable/quote?symbol=QQQ&apikey=' + FMP_KEY,
        options: { timeout: 10000, response: { response: { neverError: true } } }
      }
    },
    {
      id: 'merge-1', name: 'Merge Data',
      type: 'n8n-nodes-base.merge', typeVersion: 3,
      position: [740, 300],
      parameters: { mode: 'append' }
    },
    {
      id: 'merge-2', name: 'Merge Quotes',
      type: 'n8n-nodes-base.merge', typeVersion: 3,
      position: [740, 460],
      parameters: { mode: 'append' }
    },
    {
      id: 'merge-all', name: 'Merge All',
      type: 'n8n-nodes-base.merge', typeVersion: 3,
      position: [960, 380],
      parameters: { mode: 'append' }
    },
    {
      id: 'fmt-1', name: 'Format Response',
      type: 'n8n-nodes-base.code', typeVersion: 2,
      position: [1180, 380],
      parameters: { jsCode: FORMAT_CODE, mode: 'runOnceForAllItems' }
    },
    {
      id: 'resp-1', name: 'Respond',
      type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1,
      position: [1400, 380],
      parameters: { respondWith: 'json', responseBody: '={{ $json }}', options: { responseCode: 200 } }
    }
  ];

  wf.connections = {
    'Webhook': { main: [
      [
        { node: 'Fetch Finnhub News', type: 'main', index: 0 },
        { node: 'Fetch SPY Quote', type: 'main', index: 0 },
        { node: 'Fetch QQQ Quote', type: 'main', index: 0 }
      ]
    ]},
    'Fetch Finnhub News': { main: [[{ node: 'Merge Data', type: 'main', index: 0 }]] },
    'Fetch SPY Quote': { main: [[{ node: 'Merge Quotes', type: 'main', index: 0 }]] },
    'Fetch QQQ Quote': { main: [[{ node: 'Merge Quotes', type: 'main', index: 1 }]] },
    'Merge Data': { main: [[{ node: 'Merge All', type: 'main', index: 0 }]] },
    'Merge Quotes': { main: [[{ node: 'Merge All', type: 'main', index: 1 }]] },
    'Merge All': { main: [[{ node: 'Format Response', type: 'main', index: 0 }]] },
    'Format Response': { main: [[{ node: 'Respond', type: 'main', index: 0 }]] }
  };

  const r = await fetch(N8N_URL + '/api/v1/workflows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify(wf)
  });
  const result = await r.json();
  if (!result.id) { console.error('Failed:', JSON.stringify(result).substring(0, 300)); process.exit(1); }
  WF_ID = result.id;
  console.log('  Created:', WF_ID);

  await fetch(N8N_URL + '/api/v1/workflows/' + WF_ID + '/activate', {
    method: 'POST', headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  console.log('  Activated (9 nodes)');

  // Test
  console.log('\nTesting webhook...');
  await new Promise(r => setTimeout(r, 5000));
  const testResp = await fetch('https://n8n.dakona.net/webhook/get-market-summary', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
  });
  const testText = await testResp.text();
  console.log('HTTP', testResp.status, '| Response length:', testText.length);
  if (testText.length > 50) {
    try {
      const parsed = JSON.parse(testText);
      console.log('\n' + (parsed.response || '').substring(0, 1000));
    } catch(e) { console.log(testText.substring(0, 500)); }
  } else {
    console.log('Short/empty — checking execution...');
    await new Promise(r => setTimeout(r, 5000));
    const exResp = await fetch(N8N_URL + '/api/v1/executions?workflowId=' + WF_ID + '&limit=1&includeData=true', {
      headers: { 'X-N8N-API-KEY': N8N_KEY }
    });
    const exData = await exResp.json();
    if (exData.data && exData.data[0]) {
      const ex = exData.data[0];
      console.log('Execution:', ex.status);
      const rd = ex.data?.resultData?.runData || {};
      for (const [name, runs] of Object.entries(rd)) {
        if (runs[0]?.error) console.log('  ' + name + ': ' + runs[0].error.message?.substring(0, 200));
        else {
          const d = runs[0]?.data?.main?.[0];
          if (d) console.log('  ' + name + ': ' + d.length + ' items');
        }
      }
    }
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
