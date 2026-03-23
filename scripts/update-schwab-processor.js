/**
 * Update DAX Schwab SharePoint Processor — replace require('https') with HTTP Request nodes.
 *
 * n8n sandbox blocks require('https'). Must use native HTTP Request nodes for all HTTP calls.
 *
 * Old flow (1 giant Code node doing everything):
 *   List Schwab Exports → Process All Files in Parallel → Respond
 *
 * New flow (HTTP calls extracted into native nodes):
 *   List Schwab Exports → Extract CSV URL (Code)
 *     → Download CSV (HTTP Request)
 *     → Fetch SPY YTD (HTTP Request)
 *     → Fetch AGG YTD (HTTP Request)
 *     → Parse CSV & Build Payloads (Code)
 *     → SplitInBatches
 *       → Generate Document (HTTP Request) → back to SplitInBatches
 *     → Aggregate Results (Code)
 *     → Respond to Webhook
 *
 * Run: node scripts/update-schwab-processor.js
 */

const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const SCHWAB_WF_ID = '8y1fZmL1anhRDY0K';

// ── Code: Extract CSV URL ────────────────────────────────────────────
const EXTRACT_CSV_CODE = `
const items = $('List Schwab Exports').first().json.value || [];
const csvFiles = items.filter(f => f.name && f.name.toLowerCase().endsWith('.csv'));
if (csvFiles.length === 0) {
  return [{ json: { error: 'No CSV files found in Schwab Exports folder', downloadUrl: '', fileName: '' } }];
}
const file = csvFiles[0];
console.log('CSV file:', file.name, '|', file.size, 'bytes');
return [{ json: {
  downloadUrl: file['@microsoft.graph.downloadUrl'],
  fileName: file.name,
  fileCount: csvFiles.length
}}];
`.trim();

// ── Code: Parse CSV & Build Payloads ─────────────────────────────────
const PARSE_BUILD_CODE = `
const csvRaw = $('Download CSV').first().json.data || $('Download CSV').first().json.body || '';
const spyData = $('Fetch SPY YTD').first().json;
const aggData = $('Fetch AGG YTD').first().json;

// Extract YTD returns from Yahoo Finance
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
  'Nasdaq': spyYTD, // fallback
  '60/40 Blended': (spyYTD !== null && aggYTD !== null) ? parseFloat((0.6 * spyYTD + 0.4 * aggYTD).toFixed(2)) : null,
};

const today = new Date().toISOString().split('T')[0];
const currentQuarter = 'Q' + Math.ceil((new Date().getMonth() + 1) / 3) + ' ' + new Date().getFullYear();
const clean = v => String(v || '').trim();
const fmt$ = v => '$' + parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = v => (parseFloat(v || 0) >= 0 ? '+' : '') + parseFloat(v || 0).toFixed(2) + '%';

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
  return [{ json: { clientName: '_error', _payload: JSON.stringify({ error: 'No header row found in CSV' }) } }];
}

const lines = rawLines.slice(headerIdx).filter(l => l.trim() && !l.startsWith('#') && !l.match(/^[,\\s"]*$/));
if (lines.length < 2) {
  return [{ json: { clientName: '_error', _payload: JSON.stringify({ error: 'No data rows in CSV' }) } }];
}

const unquote = v => v.trim().replace(/^"(.*)"$/, '$1').trim();
const headers = lines[0].split(',').map(unquote);
const isPositions = (headers.includes('Symbol') || headers.includes('SYMBOL'))
  && (headers.includes('Market Value') || headers.includes('MARKET_VALUE'));
console.log('Format:', isPositions ? 'POSITIONS' : 'SUMMARY', '| Rows:', lines.length - 1);

const allPayloads = [];

if (isPositions) {
  // Parse rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"(.*)"$/, '$1'));
    const r = {};
    headers.forEach((h, idx) => { r[h] = vals[idx] || ''; });
    const n = {
      CLIENT_NAME: r['Account Name'] || r['CLIENT_NAME'] || '',
      ACCOUNT_NUMBER: r['Account Number'] || r['ACCOUNT_NUMBER'] || '',
      SYMBOL: r['Symbol'] || r['SYMBOL'] || '',
      SECURITY_NAME: r['Security Description'] || r['SECURITY_NAME'] || '',
      QUANTITY: r['Quantity'] || r['QUANTITY'] || '0',
      CURRENT_PRICE: r['Price'] || r['CURRENT_PRICE'] || '0',
      MARKET_VALUE: r['Market Value'] || r['MARKET_VALUE'] || '0',
      COST_BASIS: r['Cost Basis'] || r['COST_BASIS'] || '0',
      GAIN_LOSS_DOLLAR: r['Unrealized Gain/Loss'] || r['GAIN_LOSS_DOLLAR'] || '0',
      GAIN_LOSS_PCT: r['% Gain/Loss'] || r['GAIN_LOSS_PCT'] || '0',
      PCT_OF_ACCT: r['% of Account'] || r['% Of Acct'] || '0',
      SECURITY_TYPE: r['Security Type'] || r['SECURITY_TYPE'] || '',
      ACCOUNT_TYPE: r['Account Type'] || r['ACCOUNT_TYPE'] || '',
      RISK_PROFILE: r['Risk Profile'] || r['RISK_PROFILE'] || '',
      ADVISOR_NAME: r['Advisor Name'] || r['ADVISOR_NAME'] || '',
      BENCHMARK: r['Benchmark'] || r['BENCHMARK'] || '',
      ACCOUNT_BEGINNING_VALUE: r['Beginning Value'] || r['ACCOUNT_BEGINNING_VALUE'] || '0',
      REPORT_PERIOD: r['Report Period'] || r['REPORT_PERIOD'] || '',
      GOAL_1: r['Goal 1'] || r['GOAL_1'] || '',
      GOAL_2: r['Goal 2'] || r['GOAL_2'] || '',
      GOAL_3: r['Goal 3'] || r['GOAL_3'] || '',
      ACTION_1: r['Action 1'] || r['ACTION_1'] || '',
      ACTION_1_OWNER: r['Action 1 Owner'] || r['ACTION_1_OWNER'] || '',
      ACTION_1_DUE: r['Action 1 Due'] || r['ACTION_1_DUE'] || '',
      ACTION_2: r['Action 2'] || r['ACTION_2'] || '',
      ACTION_2_OWNER: r['Action 2 Owner'] || r['ACTION_2_OWNER'] || '',
      ACTION_2_DUE: r['Action 2 Due'] || r['ACTION_2_DUE'] || '',
      NEXT_MEETING_DATE: r['Next Meeting Date'] || r['NEXT_MEETING_DATE'] || '',
      DISCUSSION_POINT_1: r['Discussion Point 1'] || r['DISCUSSION_POINT_1'] || '',
      DISCUSSION_POINT_2: r['Discussion Point 2'] || r['DISCUSSION_POINT_2'] || '',
      DISCUSSION_POINT_3: r['Discussion Point 3'] || r['DISCUSSION_POINT_3'] || '',
    };
    if (n.CLIENT_NAME) rows.push(n);
  }

  // Group by client
  const clients = {};
  for (const row of rows) {
    if (!clients[row.CLIENT_NAME]) clients[row.CLIENT_NAME] = [];
    clients[row.CLIENT_NAME].push(row);
  }
  console.log('Clients:', Object.keys(clients).join(', '));

  const cashSymbols = ['MMKT', 'CASH', 'MONEY MARKET', 'CASHX', 'USD'];

  for (const [clientName, positions] of Object.entries(clients)) {
    const meta = positions[0];
    const portfolioValue = positions.reduce((s, p) => s + parseFloat(p.MARKET_VALUE || 0), 0);
    const beginningValue = parseFloat(meta.ACCOUNT_BEGINNING_VALUE || portfolioValue * 0.95);
    const ytdGainDollar = positions.reduce((s, p) => s + parseFloat(p.GAIN_LOSS_DOLLAR || 0), 0);
    const ytdReturnPct = beginningValue > 0 ? (ytdGainDollar / beginningValue * 100) : 0;

    const invested = positions.filter(p => !cashSymbols.includes(p.SYMBOL?.toUpperCase().trim()));
    const topHolding = invested.sort((a, b) => parseFloat(b.MARKET_VALUE) - parseFloat(a.MARKET_VALUE))[0];
    const topHoldingPct = topHolding ? (parseFloat(topHolding.MARKET_VALUE) / portfolioValue * 100).toFixed(1) : '0';
    const numPositions = invested.length;

    const bmLabel = meta.BENCHMARK || 'S&P 500';
    const bmYTD = benchmarkYTD[bmLabel] ?? null;
    const vsBenchmark = bmYTD !== null ? parseFloat((ytdReturnPct - bmYTD).toFixed(2)) : null;

    const holdingsSummary = topHolding
      ? numPositions + ' positions. Largest: ' + topHolding.SYMBOL + ' (' + topHolding.SECURITY_NAME + ') - ' + fmt$(topHolding.MARKET_VALUE) + ' (' + topHoldingPct + '% of portfolio)'
      : '';

    console.log(clientName + ': ' + fmt$(portfolioValue) + ' | YTD=' + ytdReturnPct.toFixed(2) + '%');

    allPayloads.push({
      clientName: clean(clientName),
      _payload: JSON.stringify({
        clientName: clean(clientName), firmName: '', advisorName: clean(meta.ADVISOR_NAME),
        reportPeriod: clean(meta.REPORT_PERIOD) || currentQuarter, reportDate: today,
        portfolioValue: fmt$(portfolioValue), ytdReturn: fmtPct(ytdReturnPct),
        benchmarkReturn: bmYTD !== null ? fmtPct(bmYTD) : '', vsBenchmark: vsBenchmark !== null ? fmtPct(vsBenchmark) : '',
        accountNumber: clean(meta.ACCOUNT_NUMBER), accountType: clean(meta.ACCOUNT_TYPE), riskProfile: clean(meta.RISK_PROFILE),
        meetingDate: today, meetingLocation: 'Zoom', attendees: clean(meta.ADVISOR_NAME), meetingDuration: '60 min',
        discussionPoint1: clean(meta.DISCUSSION_POINT_1), discussionPoint2: clean(meta.DISCUSSION_POINT_2), discussionPoint3: clean(meta.DISCUSSION_POINT_3),
        advisorNotes: holdingsSummary,
        goal1: clean(meta.GOAL_1), goal2: clean(meta.GOAL_2), goal3: clean(meta.GOAL_3), goalsProgressNotes: '',
        action1: clean(meta.ACTION_1), action1Owner: clean(meta.ACTION_1_OWNER), action1Due: clean(meta.ACTION_1_DUE),
        action2: clean(meta.ACTION_2), action2Owner: clean(meta.ACTION_2_OWNER), action2Due: clean(meta.ACTION_2_DUE),
        action3: '', action3Owner: '', action3Due: '',
        nextMeetingDate: clean(meta.NEXT_MEETING_DATE), nextMeetingAgenda: ''
      })
    });
  }
} else {
  // SUMMARY FORMAT
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"(.*)"$/, '$1'));
    const r = {};
    headers.forEach((h, idx) => { r[h] = vals[idx] || ''; });
    if (!r.CLIENT_NAME) continue;
    allPayloads.push({
      clientName: clean(r.CLIENT_NAME),
      _payload: JSON.stringify({
        clientName: clean(r.CLIENT_NAME), firmName: clean(r.FIRM_NAME),
        advisorName: clean(r.ADVISOR_NAME), reportPeriod: clean(r.REPORT_PERIOD) || currentQuarter,
        reportDate: today, portfolioValue: clean(r.PORTFOLIO_VALUE),
        ytdReturn: clean(r.YTD_RETURN_PCT) + '%', benchmarkReturn: clean(r.BENCHMARK_RETURN_PCT) + '%',
        vsBenchmark: clean(r.VS_BENCHMARK_PCT), accountNumber: clean(r.ACCOUNT_NUMBER),
        accountType: clean(r.ACCOUNT_TYPE), riskProfile: clean(r.RISK_PROFILE),
        meetingDate: today, meetingLocation: 'Zoom', attendees: clean(r.ADVISOR_NAME), meetingDuration: '60 min',
        discussionPoint1: clean(r.DISCUSSION_POINT_1), discussionPoint2: clean(r.DISCUSSION_POINT_2), discussionPoint3: clean(r.DISCUSSION_POINT_3),
        advisorNotes: '',
        goal1: clean(r.GOAL_1), goal2: clean(r.GOAL_2), goal3: clean(r.GOAL_3), goalsProgressNotes: '',
        action1: clean(r.ACTION_1), action1Owner: clean(r.ACTION_1_OWNER), action1Due: clean(r.ACTION_1_DUE),
        action2: clean(r.ACTION_2), action2Owner: clean(r.ACTION_2_OWNER), action2Due: clean(r.ACTION_2_DUE),
        action3: '', action3Owner: '', action3Due: '',
        nextMeetingDate: clean(r.NEXT_MEETING_DATE), nextMeetingAgenda: ''
      })
    });
  }
}

console.log('Total payloads:', allPayloads.length);
if (allPayloads.length === 0) {
  return [{ json: { clientName: '_none', _payload: '{}', _skip: true } }];
}
return allPayloads.map(p => ({ json: p }));
`.trim();

// ── Code: Aggregate Results ──────────────────────────────────────────
const AGGREGATE_CODE = `
const items = $('Generate Document').all();
const results = items.map(item => {
  const j = item.json;
  return {
    clientName: j.clientName || j._clientName || 'Unknown',
    webUrl: j.webUrl || '',
    success: !!j.webUrl
  };
});

const succeeded = results.filter(r => r.success);
const links = succeeded.map(r => '. [' + r.clientName + '](' + r.webUrl + ')').join('\\n');
console.log('Generated ' + succeeded.length + '/' + results.length + ' reports');

return [{ json: {
  summary: 'Generated ' + succeeded.length + ' of ' + results.length + ' reports',
  links,
  results
}}];
`.trim();

async function update() {
  console.log('Fetching Schwab Processor workflow...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${SCHWAB_WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();
  console.log(`  ${wf.name} — ${wf.nodes.length} nodes`);

  // ── Remove old Process node ──────────────────────────────────────
  wf.nodes = wf.nodes.filter(n => n.name !== 'Process All Files in Parallel');
  delete wf.connections['Process All Files in Parallel'];
  console.log('  - Removed Process All Files in Parallel');

  // ── Add new nodes ────────────────────────────────────────────────

  // 1. Extract CSV URL
  wf.nodes.push({
    parameters: { jsCode: EXTRACT_CSV_CODE },
    id: 'extract-csv-001',
    name: 'Extract CSV URL',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [860, 300]
  });
  console.log('  + Extract CSV URL');

  // 2. Download CSV (HTTP Request)
  wf.nodes.push({
    parameters: {
      method: 'GET',
      url: "={{ $json.downloadUrl }}",
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'User-Agent', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        ]
      },
      options: { response: { response: { responseFormat: 'text' } }, timeout: 30000 }
    },
    id: 'download-csv-001',
    name: 'Download CSV',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [1100, 300],
    continueOnFail: true
  });
  console.log('  + Download CSV (HTTP Request)');

  // 3. Fetch SPY YTD
  wf.nodes.push({
    parameters: {
      method: 'GET',
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1mo&range=ytd',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'User-Agent', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          { name: 'Accept', value: 'application/json' }
        ]
      },
      options: { timeout: 10000 }
    },
    id: 'fetch-spy-001',
    name: 'Fetch SPY YTD',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [1340, 300],
    continueOnFail: true
  });
  console.log('  + Fetch SPY YTD');

  // 4. Fetch AGG YTD
  wf.nodes.push({
    parameters: {
      method: 'GET',
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/AGG?interval=1mo&range=ytd',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'User-Agent', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          { name: 'Accept', value: 'application/json' }
        ]
      },
      options: { timeout: 10000 }
    },
    id: 'fetch-agg-001',
    name: 'Fetch AGG YTD',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [1580, 300],
    continueOnFail: true
  });
  console.log('  + Fetch AGG YTD');

  // 5. Parse CSV & Build Payloads
  wf.nodes.push({
    parameters: { mode: 'runOnceForAllItems', jsCode: PARSE_BUILD_CODE },
    id: 'parse-build-001',
    name: 'Parse CSV & Build Payloads',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1820, 300]
  });
  console.log('  + Parse CSV & Build Payloads');

  // 6. SplitInBatches (batch size 1 to process each client)
  wf.nodes.push({
    parameters: { batchSize: 1, options: {} },
    id: 'split-batch-001',
    name: 'Loop Clients',
    type: 'n8n-nodes-base.splitInBatches',
    typeVersion: 3,
    position: [2060, 300]
  });
  console.log('  + Loop Clients (SplitInBatches)');

  // 7. Generate Document (HTTP Request POST)
  wf.nodes.push({
    parameters: {
      method: 'POST',
      url: 'https://n8n.dakona.net/webhook/generate-document',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: "={{ JSON.parse($json._payload) }}",
      options: { timeout: 120000 }
    },
    id: 'gen-doc-001',
    name: 'Generate Document',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [2300, 460],
    continueOnFail: true
  });
  console.log('  + Generate Document (HTTP Request)');

  // 8. Aggregate Results
  wf.nodes.push({
    parameters: { mode: 'runOnceForAllItems', jsCode: AGGREGATE_CODE },
    id: 'aggregate-001',
    name: 'Aggregate Results',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2300, 140]
  });
  console.log('  + Aggregate Results');

  // ── Rewire connections ───────────────────────────────────────────
  // List Schwab Exports → Extract CSV URL
  wf.connections['List Schwab Exports'] = {
    main: [[{ node: 'Extract CSV URL', type: 'main', index: 0 }]]
  };

  // Extract CSV URL → Download CSV
  wf.connections['Extract CSV URL'] = {
    main: [[{ node: 'Download CSV', type: 'main', index: 0 }]]
  };

  // Download CSV → Fetch SPY YTD
  wf.connections['Download CSV'] = {
    main: [[{ node: 'Fetch SPY YTD', type: 'main', index: 0 }]]
  };

  // Fetch SPY → Fetch AGG
  wf.connections['Fetch SPY YTD'] = {
    main: [[{ node: 'Fetch AGG YTD', type: 'main', index: 0 }]]
  };

  // Fetch AGG → Parse CSV & Build Payloads
  wf.connections['Fetch AGG YTD'] = {
    main: [[{ node: 'Parse CSV & Build Payloads', type: 'main', index: 0 }]]
  };

  // Parse → Loop Clients
  wf.connections['Parse CSV & Build Payloads'] = {
    main: [[{ node: 'Loop Clients', type: 'main', index: 0 }]]
  };

  // SplitInBatches has 2 outputs: [0] = done, [1] = batch
  wf.connections['Loop Clients'] = {
    main: [
      [{ node: 'Aggregate Results', type: 'main', index: 0 }],  // done
      [{ node: 'Generate Document', type: 'main', index: 0 }]   // batch
    ]
  };

  // Generate Document → back to Loop Clients
  wf.connections['Generate Document'] = {
    main: [[{ node: 'Loop Clients', type: 'main', index: 0 }]]
  };

  // Aggregate Results → Respond to Webhook
  wf.connections['Aggregate Results'] = {
    main: [[{ node: 'Respond to Webhook', type: 'main', index: 0 }]]
  };

  console.log('  Connections rewired');

  // ── Push ─────────────────────────────────────────────────────────
  console.log('\nPushing...');
  const putResp = await fetch(`${N8N_URL}/api/v1/workflows/${SCHWAB_WF_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings })
  });
  const result = await putResp.json();
  if (!result.id) { console.error('FAILED:', JSON.stringify(result).substring(0, 500)); process.exit(1); }
  console.log('  Updated:', result.id);

  await fetch(`${N8N_URL}/api/v1/workflows/${SCHWAB_WF_ID}/activate`, {
    method: 'POST', headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  console.log('  Activated');

  console.log('\nNew flow:');
  console.log('  List Schwab Exports → Extract CSV URL → Download CSV');
  console.log('  → Fetch SPY YTD → Fetch AGG YTD → Parse CSV & Build Payloads');
  console.log('  → Loop Clients → Generate Document → Loop (back)');
  console.log('  → Aggregate Results → Respond to Webhook');
}

update().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
