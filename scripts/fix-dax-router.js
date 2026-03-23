/**
 * Fix DAX Router workflow — add error handling to HTTP nodes
 * Bug: "Cannot read properties of undefined (reading 'role')"
 * Root cause: Call Market Data returns empty body → JSON parse error →
 *   no continueOnFail → workflow crashes → LibreChat gets unformatted error
 * Run: node scripts/fix-dax-router.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WORKFLOW_ID = '3tniyxZREqfnAbfo';

async function fix() {
  // 1. Fetch current workflow
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();
  console.log('Fetched:', wf.name, '| nodes:', wf.nodes.length);

  let changes = 0;

  // 2. Add continueOnFail to Call Market Data and Azure OpenAI Passthrough
  for (const node of wf.nodes) {
    if (node.name === 'Call Market Data' || node.name === 'Azure OpenAI Passthrough') {
      if (!node.continueOnFail) {
        node.continueOnFail = true;
        console.log(`  + continueOnFail on "${node.name}"`);
        changes++;
      }
    }

    // 3. Fix Format Market Response to handle errors
    if (node.name === 'Format Market Response') {
      const newCode = `// Handle errors from Call Market Data
const marketNode = $('Call Market Data').first().json;
let content;
if (marketNode?.error) {
  console.log('[DAX-ROUTER] Market data error:', marketNode.error);
  content = 'I wasn\\'t able to pull live market data right now. For real-time quotes, check your Bloomberg terminal, Schwab, or a site like finance.yahoo.com.';
} else {
  content = marketNode?.content || 'I wasn\\'t able to retrieve market data right now. Try again in a moment.';
}
const now = Math.floor(Date.now()/1000);
const id = 'chatcmpl-dax-' + now;
const c1 = JSON.stringify({ id, object: 'chat.completion.chunk', created: now, model: 'gpt-4o', choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] });
const c2 = JSON.stringify({ id, object: 'chat.completion.chunk', created: now, model: 'gpt-4o', choices: [{ index: 0, delta: { content }, finish_reason: null }] });
const c3 = JSON.stringify({ id, object: 'chat.completion.chunk', created: now, model: 'gpt-4o', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
return [{ json: { sseBody: 'data: ' + c1 + '\\n\\ndata: ' + c2 + '\\n\\ndata: ' + c3 + '\\n\\ndata: [DONE]\\n\\n' } }];`;

      if (node.parameters.jsCode !== newCode) {
        node.parameters.jsCode = newCode;
        console.log('  + Updated Format Market Response error handling');
        changes++;
      }
    }

    // 4. Fix Format General Response to handle errors
    if (node.name === 'Format General Response') {
      const newCode = `// Handle errors from Azure OpenAI Passthrough
const oaiResp = $('Azure OpenAI Passthrough').first().json;
let content;
if (oaiResp?.error) {
  console.log('[DAX-ROUTER] Azure passthrough error:', JSON.stringify(oaiResp.error).substring(0, 300));
  content = 'I ran into a temporary issue. Please try again in a moment.';
} else {
  content = oaiResp?.choices?.[0]?.message?.content || 'I am DAX, your Governed AI Workspace for RIAs.';
}
const now = Math.floor(Date.now()/1000);
const id = 'chatcmpl-dax-' + now;
const c1 = JSON.stringify({ id, object: 'chat.completion.chunk', created: now, model: 'gpt-4o', choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] });
const c2 = JSON.stringify({ id, object: 'chat.completion.chunk', created: now, model: 'gpt-4o', choices: [{ index: 0, delta: { content }, finish_reason: null }] });
const c3 = JSON.stringify({ id, object: 'chat.completion.chunk', created: now, model: 'gpt-4o', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
return [{ json: { sseBody: 'data: ' + c1 + '\\n\\ndata: ' + c2 + '\\n\\ndata: ' + c3 + '\\n\\ndata: [DONE]\\n\\n' } }];`;

      if (node.parameters.jsCode !== newCode) {
        node.parameters.jsCode = newCode;
        console.log('  + Updated Format General Response error handling');
        changes++;
      }
    }
  }

  if (changes === 0) {
    console.log('No changes needed.');
    return;
  }

  // 5. Push updated workflow
  console.log(`\nPushing ${changes} changes...`);
  const updateResp = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify({
      name: wf.name,
      nodes: wf.nodes,
      connections: wf.connections,
      settings: wf.settings
    })
  });

  const result = await updateResp.json();
  if (result.id) {
    console.log('Workflow updated successfully:', result.id);
    console.log('Active:', result.active);
  } else {
    console.error('Update failed:', JSON.stringify(result));
  }

  // 6. Re-activate (PUT deactivates by default in some n8n versions)
  const activateResp = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}/activate`, {
    method: 'POST',
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const activateResult = await activateResp.json();
  console.log('Activated:', activateResult.active);
}

fix().catch(e => console.error('ERROR:', e.message));
