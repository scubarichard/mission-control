/**
 * Fix image upload crash + enable vision in Extract Message.
 * Also update agent system prompt for image analysis.
 * Run: node scripts/fix-image-upload-crash.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '3tniyxZREqfnAbfo';

// New Extract Message — handles string + array (multipart/vision) content
const EXTRACT_CODE = `var body = $json.body || $json;
var rawMessages = body.messages || [];

// Sanitize messages — handle both string and multipart (image) content
var messages = [];
for (var i = 0; i < rawMessages.length; i++) {
  var m = rawMessages[i];
  if (!m || typeof m !== "object") continue;
  var role = String(m.role || "").trim();
  if (!role) continue;

  if (Array.isArray(m.content)) {
    // Multipart message — may contain text + image blocks
    // Keep as-is for vision models
    var hasContent = m.content.some(function(c) {
      return (c.type === "text" && c.text) || c.type === "image_url" || c.type === "image";
    });
    if (hasContent) messages.push({ role: role, content: m.content });
  } else if (typeof m.content === "string" && m.content.trim()) {
    messages.push({ role: role, content: m.content });
  } else if (m.content === undefined || m.content === null) {
    // Skip messages with no content
    continue;
  }
}

// Extract text from last user message (for routing/tool extraction)
var userText = "";
for (var j = messages.length - 1; j >= 0; j--) {
  if (messages[j].role === "user") {
    if (typeof messages[j].content === "string") {
      userText = messages[j].content;
    } else if (Array.isArray(messages[j].content)) {
      // Extract text parts from multipart
      var textParts = messages[j].content.filter(function(c) { return c.type === "text"; });
      userText = textParts.map(function(c) { return c.text || ""; }).join(" ");
      if (!userText) userText = "[Image uploaded]";
    }
    break;
  }
}

// Detect title generation requests
var lcText = userText.toLowerCase();
var isTitle = lcText.indexOf("title for the conversation") >= 0 || lcText.indexOf("concise title") >= 0 || lcText.indexOf("5-word") >= 0;

// Ensure at least one user message
if (messages.length === 0 || messages[0].role !== "user") {
  messages.unshift({ role: "user", content: userText || "Hello" });
}

return [{ json: { userText: userText, isTitle: isTitle, originalMessages: messages, originalBody: body } }];`;

// Vision capability addition to system prompt
const VISION_ADDITION = '\n\nIMAGE ANALYSIS:\nYou can analyze images that advisors upload. When an advisor uploads a screenshot, document photo, chart, or any image, describe what you see and provide relevant analysis. For financial charts — identify the security, trend, and key observations. For screenshots — read and explain the content. For documents — extract and summarize the key information.';

async function deploy() {
  console.log('Fetching...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();

  // Fix 1: Update Extract Message
  const extract = wf.nodes.find(n => n.name === 'Extract Message');
  extract.parameters.jsCode = EXTRACT_CODE;
  console.log('  Fixed Extract Message — handles multipart/image content');

  // Fix 2: Add vision to agent system prompt
  const agent = wf.nodes.find(n => n.name === 'DAX Agent');
  if (!agent.parameters.options.systemMessage.includes('IMAGE ANALYSIS')) {
    agent.parameters.options.systemMessage += VISION_ADDITION;
    console.log('  Added IMAGE ANALYSIS to system prompt');
  }

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
