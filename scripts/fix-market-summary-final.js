/**
 * Fix Market Summary Tool — proper escaping for Code node.
 * Run: node scripts/fix-market-summary-final.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '3tniyxZREqfnAbfo';
const FMP_KEY = 'd65SRP1CgzVzaMfhwEniVWMLF7pWNwIn';
const FINNHUB_KEY = 'd7223bpr01qjeeefjd60d7223bpr01qjeeefjd6g';

// Build code as array of lines — avoids template literal escaping issues
const TOOL_CODE = [
  'var https = require("https");',
  '',
  'function httpGet(hostname, path) {',
  '  return new Promise(function(resolve) {',
  '    https.get({ hostname: hostname, path: path, timeout: 15000 }, function(res) {',
  '      var data = "";',
  '      res.on("data", function(c) { data += c; });',
  '      res.on("end", function() {',
  '        try { resolve(JSON.parse(data)); } catch(e) { resolve(null); }',
  '      });',
  '    }).on("error", function() { resolve(null); }).on("timeout", function() { resolve(null); });',
  '  });',
  '}',
  '',
  '// 1. Finnhub news',
  'var headlines = [];',
  'var fhData = await httpGet("finnhub.io", "/api/v1/news?category=general&token=' + FINNHUB_KEY + '");',
  'if (fhData && Array.isArray(fhData)) {',
  '  headlines = fhData.slice(0, 8).map(function(n) {',
  '    return {',
  '      title: n.headline || "",',
  '      summary: (n.summary || "").substring(0, 150),',
  '      source: n.source || "Unknown",',
  '      published: n.datetime ? new Date(n.datetime * 1000).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : ""',
  '    };',
  '  });',
  '}',
  '',
  '// 2. Finnhub quotes — full major indices',
  'var symbols = ["SPY", "DIA", "QQQ", "IWM", "TLT", "GLD", "VIXY"];',
  'var labelMap = { SPY: "S&P 500", DIA: "Dow Jones", QQQ: "Nasdaq 100", IWM: "Russell 2000", TLT: "20yr Treasury", GLD: "Gold", VIXY: "VIX (VIXY)" };',
  'var quoteLines = [];',
  'for (var i = 0; i < symbols.length; i++) {',
  '  var qd = await httpGet("finnhub.io", "/api/v1/quote?symbol=" + symbols[i] + "&token=' + FINNHUB_KEY + '");',
  '  if (qd && qd.c > 0) {',
  '    var pct = qd.pc > 0 ? ((qd.c - qd.pc) / qd.pc * 100) : 0;',
  '    quoteLines.push((labelMap[symbols[i]] || symbols[i]) + ": $" + qd.c.toFixed(2) + " (" + (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%)");',
  '  }',
  '}',
  'var snapshot = quoteLines.join("\\n");',
  '',
  '// 3. Format',
  'var today = new Date().toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric", year: "numeric" });',
  '',
  'var headlineText = headlines.length > 0',
  '  ? headlines.map(function(h, i) {',
  '      return (i+1) + ". " + h.title + "\\n   " + (h.summary || "") + "\\n   " + h.source + " | " + h.published;',
  '    }).join("\\n\\n")',
  '  : "No market news available.";',
  '',
  'return "MARKET SUMMARY — " + today + "\\n\\nKEY INDICES\\n" + (snapshot || "Price data unavailable") + "\\n\\nTOP MARKET STORIES\\n" + headlineText + "\\n\\nSource: FMP/Finnhub live data";',
].join('\n');

async function main() {
  const resp = await fetch(N8N_URL + '/api/v1/workflows/' + WF_ID, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const router = await resp.json();

  const tool = router.nodes.find(n => n.name === 'Market Summary Tool');
  if (!tool) { console.error('Tool not found'); process.exit(1); }

  tool.parameters.jsCode = TOOL_CODE;
  console.log('Updated tool code (' + TOOL_CODE.length + ' chars)');

  // Update system prompt — index defaults
  const agent = router.nodes.find(n => n.name === 'DAX Agent');
  if (agent) {
    let sp = agent.parameters.options.systemMessage || '';
    const indexBlock = 'MARKET QUERIES — INDEX DEFAULTS:\nWhen asked about "the market", "markets today", "how are markets doing" with no specific ticker — always call get_market_summary which returns ALL major indices.\nNever respond to a general market question with only SPY.\nDefault index set: S&P 500, Dow, Nasdaq, Russell 2000, Treasuries, Gold, VIX, US Dollar';
    if (sp.indexOf('INDEX DEFAULTS') < 0) {
      // Insert after the MARKET COMMENTARY block
      if (sp.indexOf('CRITICAL — MARKET COMMENTARY') >= 0) {
        sp = sp.replace(
          /NEVER say things like "the Fed is watching inflation" without calling the tool first\./,
          'NEVER say things like "the Fed is watching inflation" without calling the tool first.\n\n' + indexBlock
        );
      } else {
        sp += '\n\n' + indexBlock;
      }
      agent.parameters.options.systemMessage = sp;
      console.log('Updated system prompt with index defaults');
    }
  }

  const r = await fetch(N8N_URL + '/api/v1/workflows/' + WF_ID, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify({ name: router.name, nodes: router.nodes, connections: router.connections, settings: router.settings })
  });
  const result = await r.json();
  if (!result.id) { console.error('Failed'); process.exit(1); }

  await fetch(N8N_URL + '/api/v1/workflows/' + WF_ID + '/activate', {
    method: 'POST', headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  console.log('Deployed and activated');
}

main().catch(e => { console.error(e.message); process.exit(1); });
