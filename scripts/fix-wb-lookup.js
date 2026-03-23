/**
 * Fix WB lookup — fetch all contacts once, match by account_number in Merge code.
 * The custom_field[ID] filter doesn't work in Wealthbox API.
 * Run: node scripts/fix-wb-lookup.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '8y1fZmL1anhRDY0K';
const WB_KEY = '2565bf3734934e0facbe77c7c2accd40';

// New approach:
// 1. WB Find Contact → GET /contacts?per_page=250 (fetch ALL contacts once)
// 2. Remove WB Get Notes (we'll fetch notes per-contact in the Merge code...
//    Actually we can't do HTTP in code. Let me think...)
//
// Better approach:
// 1. WB Fetch All Contacts → GET /contacts?per_page=250
// 2. Merge WB Data (Code) → match contact by account number, extract from the single API response
// 3. We lose per-contact notes, BUT notes can be fetched in a follow-up
//
// Actually best approach:
// Keep the existing flow but fix the URL to fetch ALL contacts (no filter),
// then in Merge WB Data, match the right contact by account number from the full list.
// For notes: WB Get Notes runs per-item but we need to pass the correct contact_id.
// Since WB Find Contact returns ALL contacts for each item (same response),
// we can look up the right contact in the Merge code.

const MERGE_CODE = `
const parseItems = $('Parse CSV & Build Payloads').all();
const wbAllContacts = $('WB Find Contact').first().json.contacts || [];
const wbAllNotes = $('WB Get Notes').all();

// Build account number → contact map
const contactsByAcct = {};
for (const c of wbAllContacts) {
  const acctField = c.custom_fields?.find(f => f.name === 'account_number');
  if (acctField?.value) contactsByAcct[acctField.value] = c;
}
console.log('[WB] Contacts loaded:', wbAllContacts.length, '| Mapped by acct:', Object.keys(contactsByAcct).join(', '));

const results = [];
for (let i = 0; i < parseItems.length; i++) {
  const parseData = parseItems[i].json;
  const doc = JSON.parse(parseData._payload);

  // Match contact by account number
  const contact = contactsByAcct[parseData.accountNumber];

  // Get notes for this contact
  let noteContent = '';
  if (contact) {
    // Try to find notes from the WB Get Notes response
    // Since we fetch notes for the first contact's ID, we need to handle this differently
    const notesForContact = wbAllNotes.flatMap(n => (n.json.status_updates || []))
      .filter(n => n.linked_to?.some(lt => lt.id === contact.id));
    const meetingNote = notesForContact.find(n => n.tags?.some(t => t.name === 'Meeting'));
    noteContent = meetingNote?.content || '';
    if (!noteContent && notesForContact.length > 0) noteContent = notesForContact[0].content || '';
  }

  // Merge Wealthbox fields
  if (contact) {
    doc.riskProfile = contact.risk_tolerance || doc.riskProfile || 'Moderate';
    doc.investmentObjective = contact.investment_objective || doc.investmentObjective || 'Growth';
    doc.timeHorizon = contact.time_horizon || doc.timeHorizon || 'Long-Term';
    doc.backgroundInfo = (contact.background_info || '').substring(0, 500);
    console.log('[WB] Matched ' + doc.clientName + ' → WB: ' + contact.name + ' | risk: ' + contact.risk_tolerance);
  } else {
    console.log('[WB] No match for ' + doc.clientName + ' (acct: ' + parseData.accountNumber + ')');
  }

  // Parse goals and actions from note content
  if (noteContent) {
    const goalLines = noteContent.split(/[.!]/).filter(s => /goal|objective|target|plan|fund|retire|save|independence|income|estate/i.test(s)).slice(0, 3);
    const actionLines = noteContent.split(/[.!]/).filter(s => /action|follow.?up|next step|todo|schedule|review|rebalance|update|discuss|consider|evaluate/i.test(s)).slice(0, 3);

    doc.goal1 = doc.goal1 || goalLines[0]?.trim() || '';
    doc.goal2 = doc.goal2 || goalLines[1]?.trim() || '';
    doc.goal3 = doc.goal3 || goalLines[2]?.trim() || '';
    doc.goalsProgressNotes = doc.goalsProgressNotes || noteContent.substring(0, 300);
    doc.discussionPoint1 = doc.discussionPoint1 || actionLines[0]?.trim() || '';
    doc.discussionPoint2 = doc.discussionPoint2 || actionLines[1]?.trim() || '';
    doc.discussionPoint3 = doc.discussionPoint3 || actionLines[2]?.trim() || '';
    doc.advisorNotes = noteContent.substring(0, 500);
    doc.action1 = doc.action1 || actionLines[0]?.trim() || '';
    doc.action1Owner = 'Brett Stone';
    doc.action2 = doc.action2 || actionLines[1]?.trim() || '';
    doc.action2Owner = 'Brett Stone';
    doc.action3 = doc.action3 || actionLines[2]?.trim() || '';
    doc.action3Owner = 'Brett Stone';
  }

  results.push({ json: { clientName: parseData.clientName, _payload: JSON.stringify(doc) } });
}

console.log('[WB] Total:', results.length, 'payloads merged');
return results;
`.trim();

async function update() {
  console.log('Fetching workflow...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();

  // Fix WB Find Contact — fetch ALL contacts (per_page=250)
  const wbFind = wf.nodes.find(n => n.name === 'WB Find Contact');
  wbFind.parameters.url = 'https://api.crmworkspace.com/v1/contacts?per_page=250';
  console.log('  WB Find: fetch all contacts (per_page=250)');

  // Fix WB Get Notes — fetch all notes (not filtered by contact_id since we need all)
  const wbNotes = wf.nodes.find(n => n.name === 'WB Get Notes');
  wbNotes.parameters.url = 'https://api.crmworkspace.com/v1/notes?per_page=250';
  console.log('  WB Notes: fetch all notes (per_page=250)');

  // Update Merge WB Data
  const mergeNode = wf.nodes.find(n => n.name === 'Merge WB Data');
  mergeNode.parameters.jsCode = MERGE_CODE;
  mergeNode.parameters.mode = 'runOnceForAllItems';
  console.log('  Merge: match contacts by account number');

  // Push
  console.log('Pushing...');
  const putResp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings })
  });
  const result = await putResp.json();
  if (!result.id) { console.error('FAILED:', JSON.stringify(result).substring(0, 500)); process.exit(1); }
  await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}/activate`, {
    method: 'POST', headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  console.log('  Activated');
}

update().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
