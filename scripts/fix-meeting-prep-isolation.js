/**
 * Fix meeting prep: strict contact ID filtering + anti-hallucination.
 * Run: node scripts/fix-meeting-prep-isolation.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '3tniyxZREqfnAbfo';

const ANTI_HALLUCINATION = '\n\nDATA INTEGRITY — CRITICAL:\nWhen presenting client information from tools, ONLY display data that was explicitly returned by the tool. NEVER infer, guess, or fill in missing fields from general knowledge. If a field is empty or missing, say "Not on file" — never invent values. This is especially critical for client financial data, risk profiles, and meeting notes. Presenting invented client data is a compliance violation.';

async function deploy() {
  console.log('Fetching...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();

  // Fix Meeting Prep Tool — strict contact ID note filtering
  const prep = wf.nodes.find(n => n.name === 'Meeting Prep Tool');
  let code = prep.parameters.jsCode;

  // Fix 1: After fetching notes, verify they belong to the correct contact
  code = code.replace(
    'if (!noteContent && notes.length > 0) noteContent = notes[0].content || "";',
    [
      '// Verify notes belong to correct contact',
      'var verifiedNotes = [];',
      'for (var vn = 0; vn < notes.length; vn++) {',
      '  var linkedTo = notes[vn].linked_to || [];',
      '  var isLinked = false;',
      '  for (var lt = 0; lt < linkedTo.length; lt++) {',
      '    if (linkedTo[lt].id === contact.id) { isLinked = true; break; }',
      '  }',
      '  if (isLinked) verifiedNotes.push(notes[vn]);',
      '}',
      'notes = verifiedNotes;',
      '',
      '// Re-search for meeting note in verified notes',
      'noteContent = "";',
      'for (var vk = 0; vk < notes.length; vk++) {',
      '  var vnTags = notes[vk].tags || [];',
      '  for (var vl = 0; vl < vnTags.length; vl++) {',
      '    if ((vnTags[vl].name || vnTags[vl]) === "Meeting") { noteContent = notes[vk].content || ""; break; }',
      '  }',
      '  if (noteContent) break;',
      '}',
      'if (!noteContent && notes.length > 0) noteContent = notes[0].content || "";',
    ].join('\n')
  );

  // Fix 2: Update the brief to use "Not on file" for missing data
  code = code.replace(
    '"Name: " + contact.name,',
    '"Name: " + contact.name + " (Wealthbox ID: " + contact.id + ")",'
  );
  code = code.replace(
    '"Account: " + (acct || "N/A"),',
    '"Account: " + (acct || "Not on file"),'
  );
  code = code.replace(
    'bg ? "Background: " + bg.substring(0, 250) : "",',
    'bg ? "Background: " + bg.substring(0, 250) : "Background: Not on file",'
  );
  code = code.replace(
    'noteContent ? noteContent.substring(0, 400) : "No recent notes",',
    'noteContent ? noteContent.substring(0, 400) : "No meeting notes found for this client",'
  );
  code = code.replace(
    'actions.length > 0 ? actions.map(function(a, i) { return (i + 1) + ". " + a; }).join("\\n") : "None",',
    'actions.length > 0 ? actions.map(function(a, i) { return (i + 1) + ". " + a; }).join("\\n") : "No action items on file",'
  );

  prep.parameters.jsCode = code;
  console.log('  Fixed Meeting Prep: contact ID note filtering + Not on file defaults');

  // Fix 3: Also fix get_client_info with same note verification
  const clientTool = wf.nodes.find(n => n.name === 'Client Lookup Tool');
  let clientCode = clientTool.parameters.jsCode;

  // Add note verification after fetching
  if (!clientCode.includes('verifiedNotes')) {
    clientCode = clientCode.replace(
      'if (!noteContent && notes.length > 0) noteContent = notes[0].content || "";',
      [
        '// Verify notes belong to this contact',
        'var verifiedNotes = [];',
        'for (var vn = 0; vn < notes.length; vn++) {',
        '  var linkedTo = notes[vn].linked_to || [];',
        '  var isLinked = false;',
        '  for (var lt = 0; lt < linkedTo.length; lt++) {',
        '    if (linkedTo[lt].id === contact.id) { isLinked = true; break; }',
        '  }',
        '  if (isLinked) verifiedNotes.push(notes[vn]);',
        '}',
        'notes = verifiedNotes;',
        'noteContent = "";',
        'for (var vk = 0; vk < notes.length; vk++) {',
        '  var vnTags = notes[vk].tags || [];',
        '  for (var vl = 0; vl < vnTags.length; vl++) {',
        '    if ((vnTags[vl].name || vnTags[vl]) === "Meeting") { noteContent = notes[vk].content || ""; break; }',
        '  }',
        '  if (noteContent) break;',
        '}',
        'if (!noteContent && notes.length > 0) noteContent = notes[0].content || "";',
      ].join('\n')
    );
    clientTool.parameters.jsCode = clientCode;
    console.log('  Fixed Client Lookup: contact ID note verification');
  }

  // Fix 4: Add anti-hallucination to system prompt
  const agent = wf.nodes.find(n => n.name === 'DAX Agent');
  if (!agent.parameters.options.systemMessage.includes('DATA INTEGRITY')) {
    agent.parameters.options.systemMessage += ANTI_HALLUCINATION;
    console.log('  Added DATA INTEGRITY anti-hallucination rule');
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
