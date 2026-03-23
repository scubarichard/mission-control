/**
 * Update DAX Router — replace broken market-only path with Bing Web Search
 * for all general (non-ICP, non-Schwab) queries.
 *
 * New flow:
 *   Is Schwab? (false) → Bing Web Search → Enrich with Search → Azure OpenAI → Format → Respond
 *
 * Removes: Is Market?, Call Market Data, Format Market Response, Respond Market
 *
 * Usage: BING_API_KEY=<key> node scripts/update-router-websearch.js
 */

const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WORKFLOW_ID = '3tniyxZREqfnAbfo';

async function update() {
  const BING_KEY = process.env.BING_API_KEY;
  if (!BING_KEY) {
    console.error('Error: Set BING_API_KEY environment variable.');
    console.error('  Run Deploy-WebSearch.ps1 first, or:');
    console.error('  $env:BING_API_KEY="<key>" ; node scripts/update-router-websearch.js');
    process.exit(1);
  }

  // ── 1. Fetch current workflow ──────────────────────────────────────────
  console.log('Fetching DAX Router workflow...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();
  if (!wf.nodes) {
    console.error('Failed to fetch workflow:', JSON.stringify(wf));
    process.exit(1);
  }
  console.log(`  ${wf.name} — ${wf.nodes.length} nodes`);

  // ── 2. Remove market-only nodes ────────────────────────────────────────
  const removeNames = ['Is Market?', 'Call Market Data', 'Format Market Response', 'Respond Market'];
  const before = wf.nodes.length;
  wf.nodes = wf.nodes.filter(n => !removeNames.includes(n.name));
  console.log(`  Removed ${before - wf.nodes.length} market-only nodes`);

  // Clean up their connections
  for (const name of removeNames) {
    delete wf.connections[name];
  }

  // ── 3. Add "Bing Web Search" node ──────────────────────────────────────
  wf.nodes.push({
    parameters: {
      method: 'GET',
      url: 'https://api.bing.microsoft.com/v7.0/search',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Ocp-Apim-Subscription-Key', value: BING_KEY }
        ]
      },
      sendQuery: true,
      queryParameters: {
        parameters: [
          { name: 'q', value: "={{ $('Route Input').first().json.userText }}" },
          { name: 'count', value: '5' },
          { name: 'responseFilter', value: 'Webpages,News' },
          { name: 'mkt', value: 'en-US' }
        ]
      },
      options: { timeout: 5000 }
    },
    id: 'bing-search-001',
    name: 'Bing Web Search',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [1060, 720],
    continueOnFail: true
  });
  console.log('  + Bing Web Search node');

  // ── 4. Add "Enrich with Search" node ───────────────────────────────────
  const enrichCode = [
    '// Inject Bing search results into Azure OpenAI context',
    "const routeData = $('Route Input').first().json;",
    "const searchResult = $('Bing Web Search').first().json;",
    'const body = JSON.parse(JSON.stringify(routeData.originalBody));',
    '',
    '// Build search context',
    "const pages = searchResult?.webPages?.value || [];",
    "const news  = searchResult?.news?.value || [];",
    "let ctx = '';",
    '',
    'if (pages.length > 0 || news.length > 0) {',
    "  ctx = '\\n\\n[Live web search results — use if relevant, cite the source URL when you do]\\n';",
    '  pages.slice(0, 5).forEach((r, i) => {',
    "    ctx += `[${i+1}] ${r.name}\\n${r.snippet}\\nSource: ${r.url}\\n\\n`;",
    '  });',
    '  news.slice(0, 3).forEach((r, i) => {',
    "    ctx += `[News] ${r.name} (${r.datePublished?.split('T')[0] || 'recent'})\\n${r.description}\\nSource: ${r.url}\\n\\n`;",
    '  });',
    '}',
    '',
    '// Inject into system message so Azure OpenAI can use the context',
    'const messages = [...(body.messages || [])];',
    'if (ctx) {',
    "  const si = messages.findIndex(m => m.role === 'system');",
    '  if (si >= 0) {',
    '    messages[si] = { ...messages[si], content: messages[si].content + ctx };',
    '  } else {',
    "    messages.unshift({ role: 'system', content: 'You are DAX, an AI assistant for RIAs.' + ctx });",
    '  }',
    '}',
    '',
    'body.messages = messages;',
    'delete body.stream;',
    'body.stream = false;',
    '',
    'return [{ json: { enrichedBody: body } }];'
  ].join('\n');

  wf.nodes.push({
    parameters: { jsCode: enrichCode },
    id: 'enrich-search-001',
    name: 'Enrich with Search',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1300, 720]
  });
  console.log('  + Enrich with Search node');

  // ── 5. Rewire connections ──────────────────────────────────────────────

  // Is Schwab? false → Bing Web Search (was → Is Market?)
  if (wf.connections['Is Schwab?']?.main?.[1]) {
    wf.connections['Is Schwab?'].main[1] = [
      { node: 'Bing Web Search', type: 'main', index: 0 }
    ];
  }

  // Bing Web Search → Enrich with Search
  wf.connections['Bing Web Search'] = {
    main: [[{ node: 'Enrich with Search', type: 'main', index: 0 }]]
  };

  // Enrich with Search → Azure OpenAI Passthrough
  wf.connections['Enrich with Search'] = {
    main: [[{ node: 'Azure OpenAI Passthrough', type: 'main', index: 0 }]]
  };

  // ── 6. Update Azure OpenAI Passthrough to use enriched body ────────────
  const azureNode = wf.nodes.find(n => n.name === 'Azure OpenAI Passthrough');
  if (azureNode) {
    azureNode.parameters.jsonBody = "={{ $('Enrich with Search').first().json.enrichedBody }}";
    console.log('  ~ Azure OpenAI Passthrough → now uses enriched body');
  }

  // ── 7. Push to n8n ─────────────────────────────────────────────────────
  console.log('\nPushing updated workflow...');
  const putResp = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify({
      name: wf.name,
      nodes: wf.nodes,
      connections: wf.connections,
      settings: wf.settings
    })
  });

  const result = await putResp.json();
  if (!result.id) {
    console.error('Update failed:', JSON.stringify(result));
    process.exit(1);
  }
  console.log('  Updated:', result.id);

  // ── 8. Reactivate ──────────────────────────────────────────────────────
  const actResp = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}/activate`, {
    method: 'POST',
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const actResult = await actResp.json();
  console.log('  Active:', actResult.active);

  // ── 9. Summary ─────────────────────────────────────────────────────────
  console.log('\n✓ DAX Router updated.');
  console.log('  New flow for general queries:');
  console.log('  Is Schwab? (no) → Bing Web Search → Enrich → Azure OpenAI → Format → Respond');
  console.log('\n  Market queries, news, SEC questions, and general knowledge');
  console.log('  are now grounded in live Bing results.');
}

update().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
