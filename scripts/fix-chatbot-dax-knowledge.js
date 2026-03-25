/**
 * Fix DAX product knowledge section — escape double quotes for JSON.
 * Run: node scripts/fix-chatbot-dax-knowledge.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = 'I2Z7E4UDCIeJqmEfLRdJW';

// Build the section with all double quotes pre-escaped as \"
// In this JS string, \\" produces the two characters \ and "
// which in the jsonBody represents an escaped quote inside the JSON string
const lines = [
  '',
  '',
  '---',
  '',
  'DAKONA PRODUCT \\u2014 DAX AI ASSISTANT:',
  '',
  'Dakona has built a product called DAX \\u2014 Governed AI for Registered Investment Advisors (RIAs). If a visitor asks about DAX, AI for advisors, or anything related to RIA technology, use this information:',
  '',
  'WHAT DAX IS:',
  "DAX is an AI-powered workflow platform built specifically for registered investment advisors. It runs entirely inside each client's Microsoft Azure environment \\u2014 client data never leaves the firm. It is not a generic chatbot. It has 10 built-in advisor workflows.",
  '',
  'THE 10 WORKFLOWS:',
  '1. Quarterly Report Generation \\u2014 Generates complete client review documents from Schwab positions files automatically',
  '2. Meeting Prep Brief \\u2014 Pulls full client profile, portfolio, notes, and action items before any client meeting',
  "3. Client Profile Lookup \\u2014 Instant access to any client's complete CRM profile by asking in plain English",
  "4. Smart Client Search \\u2014 Find clients by name, location, interests, or risk profile (e.g. 'show me clients who golf')",
  '5. Live Market Data \\u2014 Real-time stock and ETF prices on demand',
  '6. Email Reading & Search \\u2014 Surface client emails by sender, subject, or date range',
  "7. Email Drafting & Sending \\u2014 Draft and send emails in the advisor's voice",
  '8. Calendar Access \\u2014 View full schedule in plain language',
  '9. Meeting Scheduling \\u2014 Create, update, and cancel calendar events',
  '10. Email Organization \\u2014 Organize inbox by client automatically',
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
  '- Complete audit trail searchable by client, advisor, or date \\u2014 exportable to CSV',
  "- Client data never leaves the firm's Microsoft tenant",
  '- Built around SEC Rule 204-2, Rule 17a-4, Regulation S-P',
  '- Dedicated Compliance Portal for CCO review',
  '',
  'PRICING:',
  '- DAX Core: $500/month \\u2014 for solo to 3-advisor RIAs',
  '- DAX Enterprise: $1,000-1,500/month \\u2014 for 4+ advisor firms',
  '- No long-term contracts \\u2014 month to month',
  '',
  'HOW TO RESPOND TO DAX QUESTIONS:',
  "- If someone asks 'what is DAX?' \\u2014 explain it as governed AI for RIAs with 10 built-in workflows",
  '- If someone asks about compliance \\u2014 lead with the audit trail, data sovereignty, and CCO portal',
  '- If someone asks about cost savings \\u2014 lead with quarterly reports and meeting prep time savings',
  '- If someone asks to see a demo \\u2014 direct them to schedule a discovery call at dakona.com/dax',
  '- If someone asks if it works with their CRM \\u2014 Wealthbox and Redtail are supported today',
  '- If someone asks about security \\u2014 emphasize data never leaves their Microsoft tenant',
  '',
  'WHAT TO AVOID:',
  '- Never mention Azure, APIs, or technical infrastructure in your response unless specifically asked',
  "- Never guarantee SEC compliance \\u2014 say 'compliance-focused architecture designed to support RIA requirements'",
  '- Never make investment recommendations',
];

// Join with literal \n for the jsonBody string
const DAX_SECTION = lines.join('\\n');

async function fix() {
  console.log('Fetching...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();
  const claude = wf.nodes.find(n => n.name === 'Claude Agent');
  let jb = claude.parameters.jsonBody;

  // Remove the broken DAX section
  const startMarker = '\\n\\n---\\n\\nDAKONA PRODUCT';
  const endMarker = 'Never make investment recommendations';
  const startIdx = jb.indexOf(startMarker);
  const endIdx = jb.indexOf(endMarker);

  if (startIdx >= 0 && endIdx >= 0) {
    const afterEnd = endIdx + endMarker.length;
    console.log('  Removing broken section (chars ' + startIdx + ' to ' + afterEnd + ')');
    jb = jb.substring(0, startIdx) + jb.substring(afterEnd);
  } else {
    console.log('  No existing DAKONA section found to remove');
  }

  // Now find the end of the system prompt to re-insert
  const promptEnd = "What's your name and email?'\"";
  const insertIdx = jb.indexOf(promptEnd);
  if (insertIdx < 0) {
    console.error('Could not find system prompt end marker');
    process.exit(1);
  }

  // Insert before the closing quote
  const beforeQuote = insertIdx + promptEnd.length - 1;
  jb = jb.substring(0, beforeQuote) + DAX_SECTION + jb.substring(beforeQuote);

  // Verify no unescaped double quotes in the DAX section
  // The section should only use single quotes and unicode em-dashes
  const sectionInBody = jb.substring(beforeQuote, beforeQuote + DAX_SECTION.length);
  const dqCount = (sectionInBody.match(/[^\\]"/g) || []).length;
  console.log('  Unescaped double quotes in section:', dqCount, '(should be 0)');

  claude.parameters.jsonBody = jb;
  console.log('  Re-inserted DAX product knowledge with safe escaping');

  // Save
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
  console.log('  Activated — chatbot fixed');
}

fix().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
