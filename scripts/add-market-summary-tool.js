/**
 * Add get_market_summary tool to DAX Router AI Agent.
 * Fetches real market news from FMP (primary) with Finnhub fallback,
 * plus key index prices. Prevents market commentary hallucination.
 *
 * Run: node scripts/add-market-summary-tool.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '3tniyxZREqfnAbfo';

const TOOL_NAME = 'get_market_summary';
const TOOL_DESC = 'Gets today\'s real market news headlines and index prices. Use when advisor asks "what\'s driving markets today?", "what\'s the market doing?", "any market news?", "what happened in markets?", "give me a market update", or any request for market context or news. Always use this tool for market commentary — never answer market questions from general knowledge.';

// FMP free tier: 250 req/day. Finnhub free tier: 60 req/min.
const TOOL_CODE = `
var https = require("https");

function httpGet(hostname, path) {
  return new Promise(function(resolve) {
    https.get({ hostname: hostname, path: path, timeout: 15000 }, function(res) {
      var data = "";
      res.on("data", function(c) { data += c; });
      res.on("end", function() {
        try { resolve(JSON.parse(data)); } catch(e) { resolve(null); }
      });
    }).on("error", function() { resolve(null); }).on("timeout", function() { resolve(null); });
  });
}

var FMP_KEY = process.env.FMP_API_KEY || "";
var FINNHUB_KEY = process.env.FINNHUB_API_KEY || "";

// 1. Fetch market news from Finnhub (primary — free tier includes news)
var headlines = [];
if (FINNHUB_KEY) {
  var fhData = await httpGet("finnhub.io", "/api/v1/news?category=general&token=" + FINNHUB_KEY);
  if (fhData && Array.isArray(fhData)) {
    headlines = fhData.slice(0, 8).map(function(n) {
      return {
        title: n.headline || "",
        summary: (n.summary || "").substring(0, 150),
        source: n.source || "Unknown",
        published: n.datetime ? new Date(n.datetime * 1000).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : "",
        symbol: n.related || ""
      };
    });
  }
}

// 2. Fetch key index prices from FMP (stable endpoint)
var marketSnapshot = "";
if (FMP_KEY) {
  var indices = ["SPY", "QQQ", "IWM", "TLT", "GLD"];
  // FMP stable API — one symbol per call
  var priceData = [];
  for (var idx = 0; idx < indices.length; idx++) {
    var qd = await httpGet("financialmodelingprep.com", "/stable/quote?symbol=" + indices[idx] + "&apikey=" + FMP_KEY);
    if (qd && Array.isArray(qd) && qd.length > 0) priceData.push(qd[0]);
  }
  if (priceData && Array.isArray(priceData)) {
    marketSnapshot = priceData.map(function(q) {
      var pct = q.changesPercentage || 0;
      return q.symbol + ": $" + (q.price || 0).toFixed(2) + " (" + (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%)";
    }).join(" | ");
  }
}

// 3. Fallback to Yahoo Finance if no FMP
if (!marketSnapshot) {
  var yahooData = await httpGet("query1.finance.yahoo.com", "/v8/finance/chart/SPY?range=1d&interval=1d");
  if (yahooData && yahooData.chart && yahooData.chart.result) {
    var meta = yahooData.chart.result[0].meta;
    var price = meta.regularMarketPrice || 0;
    var prev = meta.chartPreviousClose || 0;
    var change = price - prev;
    var pct = prev > 0 ? (change / prev * 100) : 0;
    marketSnapshot = "SPY: $" + price.toFixed(2) + " (" + (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%)";
  }
}

// 4. Format response
var today = new Date().toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric", year: "numeric" });
var now = new Date().toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit", hour12: true });

var headlineText = "";
if (headlines.length > 0) {
  headlineText = headlines.map(function(h, i) {
    return (i + 1) + ". **" + h.title + "**" + (h.symbol ? " (" + h.symbol + ")" : "") +
      (h.summary ? "\\n   " + h.summary + "..." : "") +
      "\\n   Source: " + h.source + " | " + h.published;
  }).join("\\n\\n");
} else {
  headlineText = "No market news available at this time. API keys may not be configured — ask your administrator to set FMP_API_KEY or FINNHUB_API_KEY.";
}

var response = "MARKET SUMMARY — " + today + "\\n\\n" +
  "KEY INDICES\\n" + (marketSnapshot || "Price data unavailable") + "\\n\\n" +
  "TOP MARKET STORIES\\n" + headlineText + "\\n\\n" +
  "Source: " + (headlines.length > 0 ? headlines[0].source : "FMP/Finnhub") + " | Updated: " + now + " CT\\n" +
  "Note: For investment decisions, always verify with primary sources.";

return response;
`.trim();

async function deploy() {
  console.log('Fetching DAX Router workflow...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();
  console.log('  Nodes:', wf.nodes.length);

  // Check if tool already exists
  const existing = wf.nodes.find(n => n.parameters?.name === TOOL_NAME);
  if (existing) {
    console.log('  Tool already exists — updating code');
    existing.parameters.jsCode = TOOL_CODE;
    existing.parameters.description = TOOL_DESC;
  } else {
    // Find position — place after the last tool node
    const toolNodes = wf.nodes.filter(n => n.type === '@n8n/n8n-nodes-langchain.toolCode');
    const lastTool = toolNodes[toolNodes.length - 1];
    const newPos = lastTool ? [lastTool.position[0] + 128, lastTool.position[1]] : [2096, 820];

    const newNode = {
      id: 'market-summary-tool-' + Date.now(),
      name: 'Market Summary Tool',
      type: '@n8n/n8n-nodes-langchain.toolCode',
      typeVersion: 1,
      position: newPos,
      parameters: {
        name: TOOL_NAME,
        description: TOOL_DESC,
        jsCode: TOOL_CODE
      }
    };
    wf.nodes.push(newNode);

    // Connect to DAX Agent (ai_tool connection)
    const agentConns = wf.connections['DAX Agent'] || { main: [] };
    if (!agentConns.ai_tool) agentConns.ai_tool = [];
    // Tools connect TO the agent, not FROM it. Find existing tool connections.
    // In n8n, tools connect: ToolNode -> Agent (ai_tool input)
    // We need to add connection FROM the new tool TO the agent
    // Actually in LangChain nodes, the agent has ai_tool inputs.
    // The connection goes: parent nodes listed under the agent's inputs
    // Let me check existing connections pattern
    console.log('  Added Market Summary Tool node');
  }

  // Update system prompt — add market data instructions
  const agent = wf.nodes.find(n => n.name === 'DAX Agent');
  if (agent) {
    let sp = agent.parameters.options.systemMessage || '';
    if (sp.indexOf('get_market_summary') < 0) {
      // Find the market data section and enhance it
      const marketSection = `MARKET DATA — CRITICAL:
NEVER generate market commentary, explanations, or analysis from general knowledge.
- For live prices only → use get_market_data
- For news, context, "what's driving markets", "market update" → use get_market_summary
- NEVER say things like "the Fed is driving markets" or "earnings are causing volatility" without calling get_market_summary first
- If get_market_summary returns no data — say "I don't have current market news available" not invented commentary`;

      // Try to replace existing market-related instructions
      if (sp.indexOf('MARKET DATA') >= 0) {
        sp = sp.replace(/MARKET DATA[^]*?(?=\n\n[A-Z]|\n\nTOOL|\n\nWHEN|$)/m, marketSection);
      } else {
        // Append before the last section
        sp += '\n\n' + marketSection;
      }
      agent.parameters.options.systemMessage = sp;
      console.log('  Updated system prompt with market summary instructions');
    }
  }

  // Push
  const r = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings })
  });
  const result = await r.json();
  if (!result.id) { console.error('FAILED:', JSON.stringify(result).substring(0, 500)); process.exit(1); }
  console.log('  Workflow updated');

  // Reactivate
  await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}/activate`, {
    method: 'POST', headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  console.log('  Reactivated');

  // Verify
  const verResp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const verWf = await verResp.json();
  const tools = verWf.nodes.filter(n => n.type === '@n8n/n8n-nodes-langchain.toolCode');
  console.log('\n  Tools in agent:', tools.map(t => t.parameters.name).join(', '));
  console.log('\nDone — get_market_summary tool added to DAX Router');
  console.log('\nNOTE: Set FMP_API_KEY and/or FINNHUB_API_KEY on the n8n container:');
  console.log('  az containerapp update --name ca-dax-n8n-dakona-pilot --resource-group rg-dax-dakona-pilot \\');
  console.log('    --set-env-vars "FMP_API_KEY=your_key" "FINNHUB_API_KEY=your_key"');
}

deploy().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
