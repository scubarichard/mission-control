/**
 * Update Dax website chatbot system prompt with DAX AI product knowledge.
 * Appends detailed DAX product section to the existing HubSpot chatbot prompt.
 * Run: node scripts/update-chatbot-dax-knowledge.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = 'I2Z7E4UDCIeJqmEfLRdJW';

// New DAX product knowledge section — using \n for literal newlines in the n8n expression string
const DAX_SECTION = [
  '',
  '',
  '---',
  '',
  'DAKONA PRODUCT — DAX AI ASSISTANT:',
  '',
  'Dakona has built a product called DAX — Governed AI for Registered Investment Advisors (RIAs). If a visitor asks about DAX, AI for advisors, or anything related to RIA technology, use this information:',
  '',
  'WHAT DAX IS:',
  'DAX is an AI-powered workflow platform built specifically for registered investment advisors. It runs entirely inside each client\'s Microsoft Azure environment — client data never leaves the firm. It is not a generic chatbot. It has 10 built-in advisor workflows.',
  '',
  'THE 10 WORKFLOWS:',
  '1. Quarterly Report Generation — Generates complete client review documents from Schwab positions files automatically',
  '2. Meeting Prep Brief — Pulls full client profile, portfolio, notes, and action items before any client meeting',
  '3. Client Profile Lookup — Instant access to any client\'s complete CRM profile by asking in plain English',
  '4. Smart Client Search — Find clients by name, location, interests, or risk profile ("show me clients who golf")',
  '5. Live Market Data — Real-time stock and ETF prices on demand',
  '6. Email Reading & Search — Surface client emails by sender, subject, or date range',
  '7. Email Drafting & Sending — Draft and send emails in the advisor\'s voice',
  '8. Calendar Access — View full schedule in plain language',
  '9. Meeting Scheduling — Create, update, and cancel calendar events',
  '10. Email Organization — Organize inbox by client automatically',
  '',
  'KEY BENEFITS FOR FIRM OWNERS:',
  '- Quarterly reviews that took hours now take minutes',
  '- Walk into every meeting fully prepared',
  '- Respond to clients faster with instant access to their full profile',
  '- More time for clients, less time on paperwork',
  '- No additional headcount needed',
  '',
  'KEY BENEFITS FOR COMPLIANCE OFFICERS:',
  '- Every AI-assisted action automatically logged to client CRM records',
  '- Complete audit trail searchable by client, advisor, or date — exportable to CSV',
  '- Client data never leaves the firm\'s Microsoft tenant',
  '- Built around SEC Rule 204-2, Rule 17a-4, Regulation S-P',
  '- Dedicated Compliance Portal for CCO review',
  '',
  'PRICING:',
  '- DAX Core: $500/month — for solo to 3-advisor RIAs',
  '- DAX Enterprise: $1,000-1,500/month — for 4+ advisor firms',
  '- No long-term contracts — month to month',
  '',
  'HOW TO RESPOND TO DAX QUESTIONS:',
  '- If someone asks "what is DAX?" — explain it as governed AI for RIAs with 10 built-in workflows',
  '- If someone asks about compliance — lead with the audit trail, data sovereignty, and CCO portal',
  '- If someone asks about cost savings — lead with quarterly reports and meeting prep time savings',
  '- If someone asks to see a demo — direct them to schedule a discovery call at dakona.com/dax',
  '- If someone asks if it works with their CRM — Wealthbox and Redtail are supported today',
  '- If someone asks about security — emphasize data never leaves their Microsoft tenant',
  '',
  'WHAT TO AVOID:',
  '- Never mention Azure, APIs, or technical infrastructure in your response unless specifically asked',
  '- Never guarantee SEC compliance — say "compliance-focused architecture designed to support RIA requirements"',
  '- Never make investment recommendations',
].join('\\n');

async function deploy() {
  console.log('Fetching workflow...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();
  const claude = wf.nodes.find(n => n.name === 'Claude Agent');
  if (!claude) { console.error('Claude Agent node not found'); process.exit(1); }

  let jsonBody = claude.parameters.jsonBody;

  // Idempotency check
  if (jsonBody.indexOf('DAKONA PRODUCT') >= 0) {
    console.log('DAX product knowledge already present — skipping');
    return;
  }

  // Find the end of the system prompt value
  // The system prompt ends before '",\n  "messages"' in the jsonBody string
  // In the raw string, \n is literal backslash-n
  const marker = "Great question for our team. What's your name and email?'\"";
  const insertIdx = jsonBody.indexOf(marker);

  if (insertIdx < 0) {
    // Fallback: find the closing quote before "messages"
    console.log('Primary marker not found, trying fallback...');
    const msgIdx = jsonBody.indexOf('"messages"');
    if (msgIdx < 0) { console.error('Could not find messages field'); process.exit(1); }
    // Walk backwards from "messages" to find the closing quote of system
    let qIdx = jsonBody.lastIndexOf('"', msgIdx - 3);
    if (qIdx < 0) { console.error('Could not find system field end'); process.exit(1); }
    // Insert before this closing quote
    jsonBody = jsonBody.substring(0, qIdx) + DAX_SECTION + jsonBody.substring(qIdx);
  } else {
    // Insert before the closing quote at the end of the marker
    const beforeQuote = insertIdx + marker.length - 1; // position of the "
    jsonBody = jsonBody.substring(0, beforeQuote) + DAX_SECTION + jsonBody.substring(beforeQuote);
  }

  claude.parameters.jsonBody = jsonBody;
  console.log('  Appended DAX product knowledge section');

  // Also update the old DAX pricing to avoid contradiction
  // Old: "Starts at $350/month" → add note that detailed pricing is below
  if (jsonBody.indexOf('Starts at $350/month') >= 0) {
    jsonBody = jsonBody.replace(
      'Starts at $350/month\\n- Current status: Beta - available now for Dakona clients',
      'See PRICING section below for current DAX pricing tiers'
    );
    claude.parameters.jsonBody = jsonBody;
    console.log('  Updated old DAX pricing reference to point to new section');
  }

  // Save workflow
  const r = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings })
  });
  const result = await r.json();
  if (!result.id) { console.error('FAILED:', JSON.stringify(result).substring(0, 500)); process.exit(1); }

  // Activate
  await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}/activate`, {
    method: 'POST', headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  console.log('  Activated — chatbot now has DAX product knowledge');
}

deploy().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
