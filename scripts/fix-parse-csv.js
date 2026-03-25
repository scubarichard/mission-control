/**
 * Fix Parse CSV & Build Payloads node — parseMoney(), topHolding, advisor defaults
 * Run: node scripts/fix-parse-csv.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '8y1fZmL1anhRDY0K';

const NEW_CODE = `
// Proper CSV parser — handles quoted fields with embedded commas
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (c === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  fields.push(current.trim());
  return fields;
}

// Strip "$102,485.00" → 102485.00, "-$1,656.00" → -1656.00, "31.1%" → 31.1
function parseMoney(val) {
  if (!val) return 0;
  const neg = String(val).includes('-') || String(val).startsWith('(');
  const s = String(val).replace(/[\\$,%()\\s]/g, '');
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return neg && n > 0 ? -n : n;
}

const csvRaw = $('Download CSV').first().json.data || $('Download CSV').first().json.body || '';
const spyData = $('Fetch SPY YTD').first().json;
const aggData = $('Fetch AGG YTD').first().json;

function extractYTD(data) {
  const result = data?.chart?.result?.[0];
  if (!result) return null;
  const closes = result?.indicators?.quote?.[0]?.close || [];
  const current = result?.meta?.regularMarketPrice;
  const first = closes.find(c => c != null);
  if (!first || !current) return null;
  return parseFloat(((current - first) / first * 100).toFixed(2));
}
const spyYTD = extractYTD(spyData);
const aggYTD = extractYTD(aggData);
console.log('SPY YTD:', spyYTD, '% | AGG YTD:', aggYTD, '%');

const benchmarkYTD = {
  'S&P 500': spyYTD,
  'Bloomberg Aggregate': aggYTD,
  'Bloomberg Agg': aggYTD,
  'Nasdaq': spyYTD,
  '60/40 Blended': (spyYTD !== null && aggYTD !== null) ? parseFloat((0.6 * spyYTD + 0.4 * aggYTD).toFixed(2)) : null,
};

const today = new Date().toISOString().split('T')[0];
const currentQuarter = 'Q' + Math.ceil((new Date().getMonth() + 1) / 3) + ' ' + new Date().getFullYear();
const clean = v => String(v || '').trim();
const fmtDollar = v => '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = v => (Number(v || 0) >= 0 ? '+' : '') + Number(v || 0).toFixed(2) + '%';

// Parse CSV
const rawLines = csvRaw.split('\\n');
let headerIdx = -1;
for (let i = 0; i < Math.min(rawLines.length, 15); i++) {
  const l = rawLines[i].replace(/"/g, '');
  if (l.includes('Account Name') || l.includes('CLIENT_NAME') || l.includes('Account Number')) {
    headerIdx = i; break;
  }
}
if (headerIdx === -1) {
  return [{ json: { clientName: '_error', accountNumber: '', _payload: '{}' } }];
}

const lines = rawLines.slice(headerIdx).filter(l => l.trim() && !l.startsWith('#') && !/^[,\\s"]*$/.test(l));
const headers = parseCSVLine(lines[0]);
console.log('Headers:', headers.join(' | '));
console.log('Data rows:', lines.length - 1);

const cashSymbols = ['MMKT', 'CASH', 'MONEY MARKET', 'CASHX', 'USD', 'SWVXX', 'SNAXX', 'SNVXX'];
const allPayloads = [];

// Parse all data rows
const rows = [];
for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  const vals = parseCSVLine(lines[i]);
  const r = {};
  headers.forEach((h, idx) => { r[h] = vals[idx] || ''; });
  let name = r['Account Name'] || r['CLIENT_NAME'] || '';
  if (!name) continue;
  // Flip "Last, First" → "First Last"
  if (name.includes(',')) { const p = name.split(',').map(s => s.trim()); name = p[1] + ' ' + p[0]; }
  rows.push({
    CLIENT_NAME: name,
    ACCOUNT_NUMBER: r['Account Number'] || r['ACCOUNT_NUMBER'] || '',
    SYMBOL: (r['Symbol'] || r['SYMBOL'] || '').trim(),
    SECURITY_NAME: r['Security Description'] || r['SECURITY_NAME'] || '',
    MARKET_VALUE: parseMoney(r['Market Value'] || r['MARKET_VALUE']),
    COST_BASIS: parseMoney(r['Cost Basis'] || r['COST_BASIS']),
    GAIN_LOSS: parseMoney(r['Unrealized Gain/Loss'] || r['GAIN_LOSS_DOLLAR']),
    SECURITY_TYPE: r['Security Type'] || r['SECURITY_TYPE'] || '',
    ACCOUNT_TYPE: r['Account Type'] || r['ACCOUNT_TYPE'] || '',
  });
}

// Group by client name
const clients = {};
for (const row of rows) {
  if (!clients[row.CLIENT_NAME]) clients[row.CLIENT_NAME] = [];
  clients[row.CLIENT_NAME].push(row);
}
console.log('Clients:', Object.keys(clients).join(', '));

for (const [clientName, positions] of Object.entries(clients)) {
  const meta = positions[0];
  const portfolioValue = positions.reduce((s, p) => s + p.MARKET_VALUE, 0);
  const totalCost = positions.reduce((s, p) => s + p.COST_BASIS, 0);
  const totalGain = positions.reduce((s, p) => s + p.GAIN_LOSS, 0);
  const ytdPct = totalCost > 0 ? (totalGain / totalCost * 100) : 0;

  // Top holding (exclude cash)
  const invested = positions.filter(p => !cashSymbols.includes(p.SYMBOL.toUpperCase()));
  invested.sort((a, b) => b.MARKET_VALUE - a.MARKET_VALUE);
  const top = invested[0];
  const topStr = top ? top.SYMBOL + ' (' + top.SECURITY_NAME + ') - ' + fmtDollar(top.MARKET_VALUE) : '';

  const bmYTD = benchmarkYTD['S&P 500'] ?? null;
  const vsBm = bmYTD !== null ? parseFloat((ytdPct - bmYTD).toFixed(2)) : null;

  console.log(clientName + ': ' + fmtDollar(portfolioValue) + ' | YTD=' + ytdPct.toFixed(2) + '% | Top=' + (top?.SYMBOL || '-'));

  allPayloads.push({
    json: {
      clientName: clean(clientName),
      accountNumber: clean(meta.ACCOUNT_NUMBER),
      _payload: JSON.stringify({
        clientName: clean(clientName),
        firmName: 'Dakona, LLC',
        advisorName: 'Demo Advisor',
        reportPeriod: currentQuarter,
        reportDate: today,
        portfolioValue: fmtDollar(portfolioValue),
        ytdReturn: fmtPct(ytdPct),
        benchmarkReturn: bmYTD !== null ? fmtPct(bmYTD) : '',
        vsBenchmark: vsBm !== null ? fmtPct(vsBm) : '',
        topHolding: topStr,
        accountNumber: clean(meta.ACCOUNT_NUMBER),
        accountType: clean(meta.ACCOUNT_TYPE),
        riskProfile: '',
        investmentObjective: '',
        timeHorizon: '',
        backgroundInfo: '',
        meetingDate: today,
        meetingLocation: 'Zoom',
        attendees: 'Demo Advisor',
        meetingDuration: '60 min',
        discussionPoint1: '',
        discussionPoint2: '',
        discussionPoint3: '',
        advisorNotes: '',
        goal1: '',
        goal2: '',
        goal3: '',
        goalsProgressNotes: '',
        action1: '',
        action1Owner: '',
        action1Due: '',
        action2: '',
        action2Owner: '',
        action2Due: '',
        action3: '',
        action3Owner: '',
        action3Due: '',
        nextMeetingDate: '',
        nextMeetingAgenda: ''
      })
    }
  });
}

console.log('Total:', allPayloads.length, 'payloads');
return allPayloads;
`.trim();

async function update() {
  console.log('Fetching workflow...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();

  const parseNode = wf.nodes.find(n => n.name === 'Parse CSV & Build Payloads');
  parseNode.parameters.jsCode = NEW_CODE;
  parseNode.parameters.mode = 'runOnceForAllItems';
  console.log('Updated Parse CSV code');

  const putResp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings })
  });
  const result = await putResp.json();
  if (!result.id) { console.error('FAILED:', JSON.stringify(result).substring(0, 500)); process.exit(1); }
  await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}/activate`, {
    method: 'POST', headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  console.log('Pushed + activated');
}

update().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
