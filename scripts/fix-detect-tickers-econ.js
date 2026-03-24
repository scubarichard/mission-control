/**
 * Expand Detect Tickers — add economic indicators and rate keywords.
 * "What's the fed funds rate?" → ^IRX (13-week T-Bill proxy)
 * "10 year yield" → ^TNX
 * "oil price" → CL=F
 * etc.
 *
 * Run: node scripts/fix-detect-tickers-econ.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WORKFLOW_ID = '3tniyxZREqfnAbfo';

const DETECT_CODE = `
const routeData = $('Route Input').first().json;
const userText = routeData.userText || '';
const rawMsg = routeData.userMessage?.toString() || '';

const nameMap = {
  // Stocks
  'apple': 'AAPL', 'microsoft': 'MSFT', 'google': 'GOOGL', 'amazon': 'AMZN',
  'meta': 'META', 'nvidia': 'NVDA', 'tesla': 'TSLA', 'netflix': 'NFLX',
  'jpmorgan': 'JPM', 'goldman': 'GS', 'visa': 'V', 'mastercard': 'MA',
  'exxon': 'XOM', 'chevron': 'CVX',
  // ETFs & Indices
  'sp500': 'SPY', 's&p 500': 'SPY', 's&p': 'SPY', 'nasdaq': 'QQQ',
  'dow': 'DIA', 'dow jones': 'DIA', 'russell': 'IWM',
  'qqq': 'QQQ', 'spy': 'SPY', 'dia': 'DIA', 'iwm': 'IWM', 'voo': 'VOO',
  // Commodities
  'gold': 'GC=F', 'silver': 'SI=F', 'oil': 'CL=F', 'crude': 'CL=F',
  'natural gas': 'NG=F',
  // Crypto
  'bitcoin': 'BTC-USD', 'btc': 'BTC-USD', 'ethereum': 'ETH-USD', 'eth': 'ETH-USD',
  // Rates & Economic
  'fed funds': '^IRX', 'federal funds': '^IRX', 'fed rate': '^IRX', 'interest rate': '^IRX',
  'fed': '^IRX', 'fomc': '^IRX',
  '10 year': '^TNX', '10-year': '^TNX', 'ten year': '^TNX', '10yr': '^TNX',
  '5 year': '^FVX', '5-year': '^FVX', '5yr': '^FVX',
  '30 year': '^TYX', '30-year': '^TYX', '30yr': '^TYX',
  'treasury': '^TNX', 'treasuries': '^TNX', 't-bill': '^IRX', 'tbill': '^IRX',
  'yield': '^TNX', 'bond yield': '^TNX',
  'vix': '^VIX', 'volatility': '^VIX', 'fear index': '^VIX',
  'dollar': 'DX-Y.NYB', 'usd index': 'DX-Y.NYB', 'dxy': 'DX-Y.NYB',
};

const marketSignals = [
  'trading at', 'stock price', 'share price', 'price of', 'price for',
  'how is the market', 'market today', 'market doing', 'stock quote', 'market price',
  'what is the price', 'etf price', 'bond yield', 'yield today', 'how much is',
  'current rate', 'interest rate', 'fed funds', 'federal funds', 'fed rate',
  'treasury yield', 'what is the', 'what are the', 'where is',
  'oil price', 'gold price', 'bitcoin price', 'crypto price',
  'dollar index', 'vix', 'volatility'
];

const isMarket = marketSignals.some(s => userText.includes(s))
  || (/\\b[A-Z]{1,5}\\b/.test(rawMsg)
      && (userText.includes('price') || userText.includes('trading') || userText.includes('quote') || userText.includes('rate')));

const mapped = [];
for (const [name, ticker] of Object.entries(nameMap)) {
  if (userText.includes(name)) mapped.push(ticker);
}
const stopWords = ['I','A','THE','AND','OR','FOR','TO','AT','IS','IT','IN','MY','DO','SO','AM','AS','BE','WE','NO','IF','CAN','HAS','WAS','ARE','NOT','BUT','ALL','ANY','HOW','WHO','GET','HAS','ITS','MAY','NEW','NOW','OLD','OUR','OWN','SAY','SHE','TOO','USE'];
const explicit = (rawMsg.match(/\\b[A-Z]{1,5}\\b/g) || [])
  .filter(t => !stopWords.includes(t));
const tickers = [...new Set([...mapped, ...explicit])].slice(0, 5);
const primaryTicker = tickers[0] || 'SPY';

console.log('[DAX] isMarket:', isMarket, '| tickers:', tickers.join(','), '| primary:', primaryTicker, '| text:', userText.substring(0, 60));

return [{ json: {
  isMarket,
  tickers,
  primaryTicker,
  fetchUrl: 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(primaryTicker) + '?interval=1d&range=1d',
  originalBody: routeData.originalBody,
  userText: userText
}}];
`.trim();

async function update() {
  console.log('Fetching...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();

  const detectNode = wf.nodes.find(n => n.name === 'Detect Tickers');
  detectNode.parameters.jsCode = DETECT_CODE;
  console.log('Updated Detect Tickers with economic indicators');

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
