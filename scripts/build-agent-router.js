/**
 * Replace the DAX Router with an AI Agent.
 * GPT-4o decides which tool to call — no keyword matching.
 *
 * Run: node scripts/build-agent-router.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '3tniyxZREqfnAbfo';
const AZURE_KEY = '635645200b2c4f90a183bf3bd3d5c291';

const SYSTEM_PROMPT = `You are DAX, an AI assistant built by Dakona LLC for registered investment advisors. You are general-purpose — help with anything asked. You also have special tools for RIA-specific tasks.

When an advisor asks to generate reports, review Schwab data, or create quarterly reviews — use the generate_quarterly_reports tool.
When an advisor asks about a specific client — their goals, risk profile, meeting notes, action items, background — use the get_client_info tool.
For stock prices, market data, rates, yields — answer directly using your knowledge. Do not use tools for these.
For everything else — answer directly from your knowledge. Do not use tools for general questions, writing help, math, coding, or anything that doesn't require client data or report generation.

Be warm, direct, and genuinely helpful. Never say you don't have access to something without trying the relevant tool first.`;

const EXTRACT_CODE = `
const body = $json.body || $json;
const messages = body.messages || [];
const lastUser = [...messages].reverse().find(m => m.role === 'user');
const userText = typeof lastUser?.content === 'string' ? lastUser.content : (Array.isArray(lastUser?.content) ? lastUser.content.map(p => p.text || '').join(' ') : '');
const systemMsg = messages.find(m => m.role === 'system');
return [{ json: { userText, systemPrompt: systemMsg?.content || '', originalMessages: messages } }];
`.trim();

const FORMAT_CODE = `
const agentOutput = $json.output || $json.text || '';
const now = Math.floor(Date.now() / 1000);
const id = 'chatcmpl-dax-' + now;

const c1 = JSON.stringify({ id, object: 'chat.completion.chunk', created: now, model: 'gpt-4o', choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] });
const c2 = JSON.stringify({ id, object: 'chat.completion.chunk', created: now, model: 'gpt-4o', choices: [{ index: 0, delta: { content: agentOutput }, finish_reason: null }] });
const c3 = JSON.stringify({ id, object: 'chat.completion.chunk', created: now, model: 'gpt-4o', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
const sseBody = 'data: ' + c1 + '\\n\\ndata: ' + c2 + '\\n\\ndata: ' + c3 + '\\n\\ndata: [DONE]\\n\\n';

return [{ json: { sseBody } }];
`.trim();

async function update() {
  console.log('Fetching workflow...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();
  console.log(`  Current: ${wf.nodes.length} nodes`);

  // Keep Webhook node
  const webhook = wf.nodes.find(n => n.type.includes('webhook'));
  console.log('  Keeping Webhook:', webhook.parameters.path);

  // Build new node set
  const nodes = [
    // 1. Webhook (keep as-is)
    webhook,

    // 2. Extract Message (Code)
    {
      parameters: { jsCode: EXTRACT_CODE },
      id: 'extract-msg-001',
      name: 'Extract Message',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [500, 300]
    },

    // 3. AI Agent
    {
      parameters: {
        promptType: 'define',
        text: '={{ $json.userText }}',
        options: {
          systemMessage: SYSTEM_PROMPT,
          maxIterations: 5,
          returnIntermediateSteps: false
        }
      },
      id: 'dax-agent-001',
      name: 'DAX Agent',
      type: '@n8n/n8n-nodes-langchain.agent',
      typeVersion: 1.7,
      position: [760, 300]
    },

    // 4. Azure OpenAI Chat Model (sub-node for Agent)
    {
      parameters: {
        model: 'gpt-4o',
        options: {
          temperature: 0.7
        }
      },
      credentials: {
        azureOpenAiApi: {
          id: 'lDC3Pr5Ghg0c7dae',
          name: 'Azure Open AI account'
        }
      },
      id: 'azure-llm-001',
      name: 'Azure OpenAI GPT-4o',
      type: '@n8n/n8n-nodes-langchain.lmChatAzureOpenAi',
      typeVersion: 1,
      position: [580, 520]
    },

    // 5. Window Buffer Memory
    {
      parameters: {
        sessionIdType: 'customKey',
        sessionKey: 'dax_chat',
        contextWindowLength: 10
      },
      id: 'memory-001',
      name: 'Chat Memory',
      type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
      typeVersion: 1.3,
      position: [760, 520]
    },

    // 6. Tool: Generate Quarterly Reports
    {
      parameters: {
        name: 'generate_quarterly_reports',
        description: 'Generates quarterly investment review reports for all clients in the Schwab file on SharePoint. Use when the advisor asks to generate reports, create quarterly reviews, run Schwab reports, or process the Schwab file. No parameters needed — just call this tool.',
        url: 'https://n8n.dakona.net/webhook/schwab-processor',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '{ "source": "dax_agent" }',
        method: 'POST',
        placeholderDefinitions: {
          values: []
        }
      },
      id: 'tool-schwab-001',
      name: 'Generate Reports Tool',
      type: '@n8n/n8n-nodes-langchain.toolHttpRequest',
      typeVersion: 1.1,
      position: [940, 520]
    },

    // 7. Tool: Get Client Info
    {
      parameters: {
        name: 'get_client_info',
        description: 'Looks up a specific client in Wealthbox CRM by name. Returns their risk profile, investment objective, time horizon, goals, action items, meeting notes, background, and next meeting date. Use when advisor asks anything about a specific client.',
        url: '=https://api.crmworkspace.com/v1/contacts?per_page=250',
        sendHeaders: true,
        specifyHeaders: 'json',
        jsonHeaders: '{ "ACCESS_TOKEN": "2565bf3734934e0facbe77c7c2accd40" }',
        method: 'GET',
        placeholderDefinitions: {
          values: []
        }
      },
      id: 'tool-client-001',
      name: 'Client Lookup Tool',
      type: '@n8n/n8n-nodes-langchain.toolHttpRequest',
      typeVersion: 1.1,
      position: [1120, 520]
    },

    // 8. Format Response (Code) — wraps agent output in SSE
    {
      parameters: { jsCode: FORMAT_CODE },
      id: 'format-resp-001',
      name: 'Format Response',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1020, 300]
    },

    // 9. Respond to Webhook (SSE format for LibreChat)
    {
      parameters: {
        respondWith: 'text',
        responseBody: '={{ $json.sseBody }}',
        options: {
          responseCode: 200,
          responseHeaders: {
            entries: [
              { name: 'Content-Type', value: 'text/event-stream' },
              { name: 'Cache-Control', value: 'no-cache' },
              { name: 'Connection', value: 'keep-alive' },
              { name: 'Access-Control-Allow-Origin', value: '*' }
            ]
          }
        }
      },
      id: 'respond-001',
      name: 'Respond',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.1,
      position: [1260, 300]
    }
  ];

  // Connections
  const connections = {
    'Webhook': { main: [[{ node: 'Extract Message', type: 'main', index: 0 }]] },
    'Extract Message': { main: [[{ node: 'DAX Agent', type: 'main', index: 0 }]] },
    'Azure OpenAI GPT-4o': { ai_languageModel: [[{ node: 'DAX Agent', type: 'ai_languageModel', index: 0 }]] },
    'Chat Memory': { ai_memory: [[{ node: 'DAX Agent', type: 'ai_memory', index: 0 }]] },
    'Generate Reports Tool': { ai_tool: [[{ node: 'DAX Agent', type: 'ai_tool', index: 0 }]] },
    'Client Lookup Tool': { ai_tool: [[{ node: 'DAX Agent', type: 'ai_tool', index: 0 }]] },
    'DAX Agent': { main: [[{ node: 'Format Response', type: 'main', index: 0 }]] },
    'Format Response': { main: [[{ node: 'Respond', type: 'main', index: 0 }]] },
  };

  // Update workflow
  console.log('  Replacing with AI Agent router...');
  const putResp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify({
      name: 'DAX Router - AI Agent',
      nodes,
      connections,
      settings: wf.settings || {}
    })
  });
  const result = await putResp.json();
  if (!result.id) {
    console.error('FAILED:', JSON.stringify(result).substring(0, 500));
    process.exit(1);
  }
  console.log('  Updated:', result.id, '| Nodes:', result.nodes?.length);

  await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}/activate`, {
    method: 'POST', headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  console.log('  Activated');
  console.log('\n  Flow: Webhook → Extract Message → DAX Agent (GPT-4o + Tools) → Format Response → Respond (SSE)');
}

update().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
