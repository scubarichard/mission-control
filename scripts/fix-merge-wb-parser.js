/**
 * Fix Merge WB Data — use WB direct fields + parse background_info fallbacks,
 * fix next meeting date and action due date extraction.
 * Run: node scripts/fix-merge-wb-parser.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '8y1fZmL1anhRDY0K';

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
console.log('[WB] Contacts:', wbAllContacts.length, '| Mapped:', Object.keys(contactsByAcct).join(', '));

// Collect all notes into a flat array for filtering
const allNotes = wbAllNotes.flatMap(n => (n.json.status_updates || []));

const results = [];
for (let i = 0; i < parseItems.length; i++) {
  const parseData = parseItems[i].json;
  const doc = JSON.parse(parseData._payload);
  const contact = contactsByAcct[parseData.accountNumber];

  if (contact) {
    // ── Profile fields — use WB direct fields, fall back to background keywords ──
    const bg = contact.background_info || '';

    // Risk profile
    doc.riskProfile = contact.risk_tolerance || doc.riskProfile || '';
    if (!doc.riskProfile) {
      if (/conservative/i.test(bg)) doc.riskProfile = 'Conservative';
      else if (/aggressive/i.test(bg)) doc.riskProfile = 'Aggressive';
      else if (/moderate/i.test(bg)) doc.riskProfile = 'Moderate';
    }

    // Investment objective
    doc.investmentObjective = contact.investment_objective || doc.investmentObjective || '';
    if (!doc.investmentObjective) {
      if (/growth.*income|income.*growth/i.test(bg)) doc.investmentObjective = 'Growth & Income';
      else if (/growth/i.test(bg)) doc.investmentObjective = 'Growth';
      else if (/income/i.test(bg)) doc.investmentObjective = 'Income';
      else if (/preservation|conserv/i.test(bg)) doc.investmentObjective = 'Capital Preservation';
    }

    // Time horizon
    doc.timeHorizon = contact.time_horizon || doc.timeHorizon || '';
    if (!doc.timeHorizon) {
      if (/long.?term|10\\+|long time/i.test(bg)) doc.timeHorizon = 'Long-Term';
      else if (/mid.?term|intermediate|5.?10/i.test(bg)) doc.timeHorizon = 'Intermediate';
      else if (/short.?term|near|1.?3/i.test(bg)) doc.timeHorizon = 'Short-Term';
    }

    // Background info — plain narrative
    doc.backgroundInfo = bg;

    console.log('[WB] ' + doc.clientName + ' → ' + contact.name + ' | risk:' + doc.riskProfile + ' | obj:' + doc.investmentObjective + ' | horizon:' + doc.timeHorizon);

    // ── Meeting notes ──
    const notesForContact = allNotes.filter(n => n.linked_to?.some(lt => lt.id === contact.id));
    const meetingNote = notesForContact.find(n => n.tags?.some(t => t.name === 'Meeting'));
    const noteContent = meetingNote?.content || '';
    if (!noteContent && notesForContact.length > 0) {
      // Use most recent note as fallback
      const fallbackNote = notesForContact[0]?.content || '';
      if (fallbackNote) {
        doc.advisorNotes = fallbackNote.substring(0, 500);
        doc.goalsProgressNotes = fallbackNote.substring(0, 300);
      }
    }

    if (noteContent) {
      // Parse goals
      const goalSentences = noteContent.split(/[.!]/).filter(s =>
        /goal|objective|target|plan|fund|retire|save|independence|income|estate|college|endowment|529/i.test(s)
      ).slice(0, 3);
      doc.goal1 = doc.goal1 || goalSentences[0]?.trim() || '';
      doc.goal2 = doc.goal2 || goalSentences[1]?.trim() || '';
      doc.goal3 = doc.goal3 || goalSentences[2]?.trim() || '';

      // Parse action items — look for numbered items like (1), (2)
      const numberedActions = [];
      const numMatches = noteContent.match(/\\(\\d\\)\\s*[^(]+/g) || [];
      for (const m of numMatches) {
        const text = m.replace(/^\\(\\d\\)\\s*/, '').trim();
        // Extract due date
        const dueMatch = text.match(/(?:by|before|due)\\s+([A-Z][a-z]+ \\d+(?:,?\\s*\\d{4})?|year end|end of [A-Za-z]+)/i);
        numberedActions.push({
          action: dueMatch ? text.replace(dueMatch[0], '').trim() : text,
          owner: 'Demo Advisor',
          due: dueMatch ? dueMatch[1] : ''
        });
      }

      // Fallback: keyword-based action detection
      if (numberedActions.length === 0) {
        const actionSentences = noteContent.split(/[.!]/).filter(s =>
          /action|follow.?up|next step|schedule|review|rebalance|update|consider|evaluate|discuss/i.test(s)
        ).slice(0, 3);
        for (const s of actionSentences) {
          numberedActions.push({ action: s.trim(), owner: 'Demo Advisor', due: '' });
        }
      }

      doc.action1 = doc.action1 || numberedActions[0]?.action || '';
      doc.action1Owner = numberedActions[0]?.owner || 'Demo Advisor';
      doc.action1Due = numberedActions[0]?.due || '';
      doc.action2 = doc.action2 || numberedActions[1]?.action || '';
      doc.action2Owner = numberedActions[1]?.owner || 'Demo Advisor';
      doc.action2Due = numberedActions[1]?.due || '';
      doc.action3 = doc.action3 || numberedActions[2]?.action || '';
      doc.action3Owner = numberedActions[2]?.owner || 'Demo Advisor';
      doc.action3Due = numberedActions[2]?.due || '';

      // Discussion points — first 3 distinct sentences from note
      const discSentences = noteContent.split(/[.!]/).map(s => s.trim()).filter(s => s.length > 10).slice(0, 3);
      doc.discussionPoint1 = doc.discussionPoint1 || discSentences[0] || '';
      doc.discussionPoint2 = doc.discussionPoint2 || discSentences[1] || '';
      doc.discussionPoint3 = doc.discussionPoint3 || discSentences[2] || '';

      doc.advisorNotes = noteContent.substring(0, 500);
      doc.goalsProgressNotes = doc.goalsProgressNotes || noteContent.substring(0, 300);

      // Next meeting date
      const nextMatch = noteContent.match(/[Nn]ext meeting[:\\s]+([A-Z][a-z]+ \\d+,?\\s*\\d{4})/);
      doc.nextMeetingDate = doc.nextMeetingDate || (nextMatch ? nextMatch[1].trim() : '');
      doc.nextMeetingAgenda = doc.nextMeetingAgenda || 'Portfolio review and strategy update';
    }
  } else {
    console.log('[WB] No match: ' + doc.clientName + ' (acct:' + parseData.accountNumber + ')');
  }

  results.push({ json: { clientName: parseData.clientName, _payload: JSON.stringify(doc) } });
}

console.log('[WB] Total:', results.length);
return results;
`.trim();

async function update() {
  console.log('Fetching...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();

  const merge = wf.nodes.find(n => n.name === 'Merge WB Data');
  merge.parameters.jsCode = MERGE_CODE;
  merge.parameters.mode = 'runOnceForAllItems';
  console.log('Updated Merge WB Data: profile fields + note parsing + next meeting + action due dates');

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
  console.log('Activated');
}

update().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
