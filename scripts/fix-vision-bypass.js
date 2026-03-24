/**
 * Add vision bypass: image messages go directly to Azure OpenAI GPT-4o.
 * Run: node scripts/fix-vision-bypass.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '3tniyxZREqfnAbfo';
const AZURE_KEY = '635645200b2c4f90a1833de2bda6b753';

// Updated proxy code — handles both titles (JSON) and images (SSE)
const PROXY_CODE = [
  'var https = require("https");',
  'var input = $input.all()[0].json;',
  '',
  'var reqBody = JSON.stringify({',
  '  messages: input.originalMessages || [{ role: "user", content: input.userText || "Hello" }],',
  '  max_tokens: input.isTitle ? 50 : 4096,',
  '  temperature: 0.7',
  '});',
  '',
  'var result = await new Promise(function(resolve) {',
  '  var req = https.request({',
  '    hostname: "oai-dax-dakona-pilot.openai.azure.com",',
  '    path: "/openai/deployments/gpt-4o/chat/completions?api-version=2024-08-01-preview",',
  '    method: "POST",',
  '    headers: { "api-key": "' + AZURE_KEY + '", "Content-Type": "application/json", "Content-Length": Buffer.byteLength(reqBody) }',
  '  }, function(res) {',
  '    var data = ""; res.on("data", function(c) { data += c; }); res.on("end", function() { resolve(data); });',
  '  });',
  '  req.on("error", function(e) { resolve(JSON.stringify({ error: e.message })); });',
  '  req.write(reqBody); req.end();',
  '});',
  '',
  'var parsed = {};',
  'try { parsed = JSON.parse(result); } catch(e) { parsed = { choices: [{ message: { role: "assistant", content: "I had trouble processing that." } }] }; }',
  '',
  'if (input.isTitle) {',
  '  return [{ json: { jsonResponse: parsed, isTitle: true } }];',
  '} else {',
  '  var content = (parsed.choices && parsed.choices[0] && parsed.choices[0].message) ? parsed.choices[0].message.content : "I could not analyze that image.";',
  '  var now = Math.floor(Date.now() / 1000);',
  '  var id = "chatcmpl-dax-" + now;',
  '  var c1 = JSON.stringify({ id: id, object: "chat.completion.chunk", created: now, model: "gpt-4o", choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }] });',
  '  var c2 = JSON.stringify({ id: id, object: "chat.completion.chunk", created: now, model: "gpt-4o", choices: [{ index: 0, delta: { content: content }, finish_reason: null }] });',
  '  var c3 = JSON.stringify({ id: id, object: "chat.completion.chunk", created: now, model: "gpt-4o", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] });',
  '  return [{ json: { sseBody: "data: " + c1 + "\\n\\ndata: " + c2 + "\\n\\ndata: " + c3 + "\\n\\ndata: [DONE]\\n\\n", isTitle: false } }];',
  '}',
].join('\n');

async function deploy() {
  console.log('Fetching...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();

  // 1. Update Extract Message — add hasImage flag
  const extract = wf.nodes.find(n => n.name === 'Extract Message');
  let code = extract.parameters.jsCode;
  if (!code.includes('hasImage')) {
    code = code.replace(
      'return [{ json: { userText: userText, isTitle: isTitle, originalMessages: messages, originalBody: body } }];',
      'var hasImage = false;\n' +
      'for (var x = 0; x < messages.length; x++) {\n' +
      '  if (Array.isArray(messages[x].content)) {\n' +
      '    for (var y = 0; y < messages[x].content.length; y++) {\n' +
      '      if (messages[x].content[y].type === "image_url" || messages[x].content[y].type === "image") hasImage = true;\n' +
      '    }\n' +
      '  }\n' +
      '}\n' +
      'return [{ json: { userText: userText, isTitle: isTitle, hasImage: hasImage, originalMessages: messages, originalBody: body } }];'
    );
    extract.parameters.jsCode = code;
    console.log('  Added hasImage detection');
  }

  // 2. Update Is Title? condition → routes title OR image
  const ifTitle = wf.nodes.find(n => n.name === 'Is Title?');
  ifTitle.parameters.conditions.conditions[0].leftValue = '={{ $json.isTitle || $json.hasImage }}';
  console.log('  Is Title? → now routes title OR image');

  // 3. Update proxy — rename + handle both title/image
  const proxy = wf.nodes.find(n => n.name === 'Title Proxy' || n.name === 'Direct GPT-4o Proxy');
  proxy.name = 'Direct GPT-4o Proxy';
  proxy.parameters.jsCode = PROXY_CODE;
  console.log('  Proxy: handles titles (JSON) + images (SSE)');

  // 4. Add response routing: If Title → JSON, If Image → SSE
  // Check if "Title or Image?" node already exists
  let titleOrImage = wf.nodes.find(n => n.name === 'Title or Image?');
  if (!titleOrImage) {
    titleOrImage = {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 1 },
          conditions: [{ leftValue: '={{ $json.isTitle }}', rightValue: true, operator: { type: 'boolean', operation: 'equals' }, id: 'title-resp-check' }],
          combinator: 'and'
        },
        options: {}
      },
      id: 'if-title-resp-001',
      name: 'Title or Image?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [980, 160]
    };
    wf.nodes.push(titleOrImage);
    console.log('  Added Title or Image? router');
  }

  // 5. Add Respond Image node if not exists
  let respondImage = wf.nodes.find(n => n.name === 'Respond Image');
  if (!respondImage) {
    respondImage = {
      parameters: {
        respondWith: 'text',
        responseBody: '={{ $json.sseBody }}',
        options: {
          responseCode: 200,
          responseHeaders: { entries: [
            { name: 'Content-Type', value: 'text/event-stream' },
            { name: 'Cache-Control', value: 'no-cache' },
            { name: 'Access-Control-Allow-Origin', value: '*' }
          ]}
        }
      },
      id: 'respond-image-001',
      name: 'Respond Image',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.1,
      position: [1220, 240]
    };
    wf.nodes.push(respondImage);
    console.log('  Added Respond Image (SSE)');
  }

  // 6. Rewire connections
  wf.connections['Direct GPT-4o Proxy'] = { main: [[{ node: 'Title or Image?', type: 'main', index: 0 }]] };
  wf.connections['Title or Image?'] = {
    main: [
      [{ node: 'Respond Title', type: 'main', index: 0 }],   // true = title → JSON
      [{ node: 'Respond Image', type: 'main', index: 0 }]    // false = image → SSE
    ]
  };
  // Clean up old connections
  delete wf.connections['Title Proxy'];
  console.log('  Rewired: Proxy → Title or Image? → (JSON / SSE)');

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
  console.log('  Activated');
}

deploy().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
