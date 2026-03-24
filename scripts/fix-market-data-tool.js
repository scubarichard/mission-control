/**
 * Convert get_market_data from HTTP Request tool to Code tool.
 * Uses Yahoo Finance v8 chart with proper headers + v7 quote fallback.
 * Run: node scripts/fix-market-data-tool.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '3tniyxZREqfnAbfo';

const MARKET_CODE = `var https = require("https");
var input = $input.all()[0].json || {};

// Extract symbols from agent input or userText
var rawSymbols = input.query || input.symbols || input.symbol || "";
if (!rawSymbols && input.userText) {
  var text = input.userText;
  var lc = text.toLowerCase();
  // Map common names
  var names = { "apple": "AAPL", "microsoft": "MSFT", "google": "GOOGL", "amazon": "AMZN", "nvidia": "NVDA", "tesla": "TSLA", "meta": "META", "netflix": "NFLX", "s&p": "SPY", "sp500": "SPY", "nasdaq": "QQQ", "dow": "DIA", "gold": "GC=F", "oil": "CL=F", "crude": "CL=F", "bitcoin": "BTC-USD", "fed funds": "^IRX", "fed rate": "^IRX", "federal funds": "^IRX", "10 year": "^TNX", "treasury": "^TNX", "vix": "^VIX", "dollar": "DX-Y.NYB", "the market": "SPY", "markets": "SPY" };
  for (var nm in names) { if (lc.indexOf(nm) >= 0) { rawSymbols = names[nm]; break; } }
  // Extract explicit tickers (2-5 uppercase letters surrounded by non-letters)
  if (!rawSymbols) {
    var words = text.split(/[^A-Za-z]+/);
    var stops = ["What","How","Is","The","At","It","In","My","Do","For","To","And","Or","Are","Has","Was","Can","Get","Me","Of","On","An","By","So","No","If","Up","Am","As","Be","We"];
    for (var w = 0; w < words.length; w++) {
      var word = words[w];
      if (word.length >= 2 && word.length <= 5 && word === word.toUpperCase() && stops.indexOf(word) < 0) {
        rawSymbols = word; break;
      }
    }
  }
}
if (!rawSymbols) rawSymbols = "SPY";
var symbols = rawSymbols.split(",").map(function(s) { return s.trim().toUpperCase(); }).filter(Boolean).slice(0, 10);
if (symbols.length === 0) symbols = ["SPY"];

function fetchQuote(symbol) {
  return new Promise(function(resolve) {
    var path = "/v8/finance/chart/" + encodeURIComponent(symbol) + "?interval=1d&range=1d";
    https.get({
      hostname: "query1.finance.yahoo.com",
      path: path,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Referer": "https://finance.yahoo.com/"
      }
    }, function(res) {
      var data = "";
      res.on("data", function(c) { data += c; });
      res.on("end", function() {
        try {
          var j = JSON.parse(data);
          var meta = j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].meta;
          if (!meta) { resolve({ symbol: symbol, error: "No data" }); return; }
          var price = meta.regularMarketPrice;
          var prev = meta.chartPreviousClose || meta.previousClose;
          var change = prev ? (price - prev) : 0;
          var pct = prev ? ((change / prev) * 100) : 0;
          var name = meta.shortName || meta.longName || symbol;
          var isRate = ["^IRX", "^TNX", "^FVX", "^TYX"].indexOf(symbol) >= 0;
          resolve({
            symbol: symbol,
            name: name,
            price: isRate ? price.toFixed(3) + "%" : "$" + price.toFixed(2),
            change: (change >= 0 ? "+" : "") + (isRate ? change.toFixed(3) : change.toFixed(2)),
            changePct: (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%",
            high52: meta.fiftyTwoWeekHigh ? "$" + meta.fiftyTwoWeekHigh.toFixed(2) : "N/A",
            low52: meta.fiftyTwoWeekLow ? "$" + meta.fiftyTwoWeekLow.toFixed(2) : "N/A"
          });
        } catch(e) {
          resolve({ symbol: symbol, error: "Parse error" });
        }
      });
      res.on("error", function() { resolve({ symbol: symbol, error: "Fetch error" }); });
    }).on("error", function() { resolve({ symbol: symbol, error: "Connection error" }); });
  });
}

var results = await Promise.all(symbols.map(function(s) { return fetchQuote(s); }));

var formatted = results.map(function(r) {
  if (r.error) return r.symbol + ": " + r.error;
  return r.symbol + " (" + r.name + "): " + r.price + " (" + r.changePct + " today) | 52-week: " + r.low52 + " - " + r.high52;
}).join("\\n");

return formatted;`;

async function deploy() {
  console.log('Fetching...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();

  // Replace HTTP Request tool with Code tool
  const tool = wf.nodes.find(n => n.name === 'Market Data Tool');
  tool.type = '@n8n/n8n-nodes-langchain.toolCode';
  tool.typeVersion = 1;
  tool.parameters = {
    name: 'get_market_data',
    description: 'Fetches current stock prices, ETF prices, index levels, treasury yields, commodity prices, or crypto prices from Yahoo Finance. Use when an advisor asks about current prices, how the market is doing, how a stock or ETF is performing, treasury yields, the fed funds rate, gold/oil prices, or wants to compare holdings. Pass ticker symbols like SPY, AAPL, QQQ, ^TNX (10yr yield), ^IRX (fed funds proxy), GC=F (gold), CL=F (oil), BTC-USD (bitcoin). Multiple symbols can be comma-separated.',
    jsCode: MARKET_CODE
  };
  delete tool.credentials;
  console.log('Converted to Code tool');

  const r = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings })
  });
  const result = await r.json();
  if (!result.id) { console.error('FAILED:', JSON.stringify(result).substring(0, 500)); process.exit(1); }
  await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}/activate`, {
    method: 'POST', headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  console.log('Activated');
}

deploy().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
