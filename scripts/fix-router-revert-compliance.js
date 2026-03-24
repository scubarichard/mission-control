/**
 * Revert router — remove compliance handling from proxy, fix $json reference.
 * Keep the static compliance.html approach for now.
 * Run: node scripts/fix-router-revert-compliance.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '3tniyxZREqfnAbfo';
const AZURE_KEY = '635645200b2c4f90a1833de2bda6b753';

// Clean proxy code — title + image only, no compliance
const CLEAN_PROXY = `var https = require("https");
var input = $input.all()[0].json;

var reqBody = JSON.stringify({
  messages: input.originalMessages || [{ role: "user", content: input.userText || "Hello" }],
  max_tokens: input.isTitle ? 50 : 4096,
  temperature: 0.7
});

var result = await new Promise(function(resolve) {
  var req = https.request({
    hostname: "oai-dax-dakona-pilot.openai.azure.com",
    path: "/openai/deployments/gpt-4o/chat/completions?api-version=2024-08-01-preview",
    method: "POST",
    headers: { "api-key": "${AZURE_KEY}", "Content-Type": "application/json", "Content-Length": Buffer.byteLength(reqBody) }
  }, function(res) {
    var data = ""; res.on("data", function(c) { data += c; }); res.on("end", function() { resolve(data); });
  });
  req.on("error", function(e) { resolve(JSON.stringify({ error: e.message })); });
  req.write(reqBody); req.end();
});

var parsed = {};
try { parsed = JSON.parse(result); } catch(e) { parsed = { choices: [{ message: { role: "assistant", content: "I had trouble processing that." } }] }; }

if (input.isTitle) {
  return [{ json: { jsonResponse: parsed, isTitle: true } }];
} else {
  var content = (parsed.choices && parsed.choices[0] && parsed.choices[0].message) ? parsed.choices[0].message.content : "I could not analyze that image.";
  var now = Math.floor(Date.now() / 1000);
  var id = "chatcmpl-dax-" + now;
  var c1 = JSON.stringify({ id: id, object: "chat.completion.chunk", created: now, model: "gpt-4o", choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }] });
  var c2 = JSON.stringify({ id: id, object: "chat.completion.chunk", created: now, model: "gpt-4o", choices: [{ index: 0, delta: { content: content }, finish_reason: null }] });
  var c3 = JSON.stringify({ id: id, object: "chat.completion.chunk", created: now, model: "gpt-4o", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] });
  return [{ json: { sseBody: "data: " + c1 + "\\n\\ndata: " + c2 + "\\n\\ndata: " + c3 + "\\n\\ndata: [DONE]\\n\\n", isTitle: false } }];
}`;

async function deploy() {
  console.log('Fetching...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();

  // Restore clean proxy
  const proxy = wf.nodes.find(n => n.name === 'Direct GPT-4o Proxy');
  proxy.parameters.jsCode = CLEAN_PROXY;
  console.log('  Restored clean proxy (title + image only)');

  // Fix Extract Message — remove compliance, keep useProxy for title+image
  const extract = wf.nodes.find(n => n.name === 'Extract Message');
  let code = extract.parameters.jsCode;
  code = code.replace(/var isCompliance.*?\n/g, '');
  code = code.replace(/isCompliance: isCompliance, /g, '');
  code = code.replace('var useProxy = isTitle || hasImage || isCompliance;', 'var useProxy = isTitle || hasImage;');
  extract.parameters.jsCode = code;
  console.log('  Cleaned Extract Message');

  // Fix Is Title? condition with proper $json
  const ifTitle = wf.nodes.find(n => n.name === 'Is Title?');
  ifTitle.parameters.conditions.conditions[0].leftValue = '={{ ' + String.fromCharCode(36) + 'json.useProxy }}';
  console.log('  Fixed Is Title? condition');

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
  console.log('  Activated — router clean');
}

deploy().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
