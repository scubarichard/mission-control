/**
 * Fix: pass multipart/vision messages through to GPT-4o.
 * The Extract Message node must preserve array content blocks (images).
 * Run: node scripts/fix-image-passthrough.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '3tniyxZREqfnAbfo';

const EXTRACT_CODE = `var body = $json.body || $json;
var rawMessages = body.messages || [];
var messages = [];

for (var i = 0; i < rawMessages.length; i++) {
  var m = rawMessages[i];
  if (!m || typeof m !== "object") continue;
  var role = String(m.role || "").trim();
  if (!role) continue;

  if (Array.isArray(m.content)) {
    // Multipart — text + image blocks. Pass through as-is for GPT-4o vision.
    var hasContent = false;
    for (var c = 0; c < m.content.length; c++) {
      var part = m.content[c];
      if (part.type === "text" && part.text) hasContent = true;
      if (part.type === "image_url") hasContent = true;
      if (part.type === "image") hasContent = true;
    }
    if (hasContent) messages.push({ role: role, content: m.content });
  } else if (typeof m.content === "string" && m.content.trim()) {
    messages.push({ role: role, content: m.content });
  }
}

// Extract text from last user message for routing
var userText = "";
for (var j = messages.length - 1; j >= 0; j--) {
  if (messages[j].role === "user") {
    if (typeof messages[j].content === "string") {
      userText = messages[j].content;
    } else if (Array.isArray(messages[j].content)) {
      var parts = [];
      for (var k = 0; k < messages[j].content.length; k++) {
        if (messages[j].content[k].type === "text") parts.push(messages[j].content[k].text || "");
      }
      userText = parts.join(" ");
      if (!userText) userText = "[Image uploaded]";
    }
    break;
  }
}

// Title detection
var lcText = userText.toLowerCase();
var isTitle = lcText.indexOf("title for the conversation") >= 0 || lcText.indexOf("concise title") >= 0 || lcText.indexOf("5-word") >= 0;

if (messages.length === 0) {
  messages.push({ role: "user", content: userText || "Hello" });
}

return [{ json: { userText: userText, isTitle: isTitle, originalMessages: messages, originalBody: body } }];`;

const VISION_PROMPT = '\n\nIMAGE ANALYSIS:\nWhen an advisor uploads an image, analyze it fully. For PowerShell or terminal screenshots — read every line and explain what the commands did and what the output means. For financial charts — identify the security, timeframe, and describe the trend. For Schwab statements or documents — extract the key numbers and summarize. For error messages — diagnose the problem and suggest fixes. Never say you cannot see an image — always describe what you observe.';

async function deploy() {
  console.log('Fetching...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();

  // Update Extract Message
  const extract = wf.nodes.find(n => n.name === 'Extract Message');
  extract.parameters.jsCode = EXTRACT_CODE;
  console.log('  Updated Extract Message — preserves multipart content');

  // Update agent system prompt
  const agent = wf.nodes.find(n => n.name === 'DAX Agent');
  // Remove old IMAGE ANALYSIS section if present, add new one
  let prompt = agent.parameters.options.systemMessage;
  prompt = prompt.replace(/\n\nIMAGE ANALYSIS:[\s\S]*$/, '');
  prompt += VISION_PROMPT;
  agent.parameters.options.systemMessage = prompt;
  console.log('  Updated system prompt with vision instructions');

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
