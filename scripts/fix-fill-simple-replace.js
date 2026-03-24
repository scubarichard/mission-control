/**
 * Fix Fill Placeholders — simple string replacement on Word XML.
 * No docxtemplater, no child process. Just PizZip + string replace.
 *
 * Run: node scripts/fix-fill-simple-replace.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = 'MtkxBYcyV1VYt02e';

const FILL_CODE = `
const https = require('https');
const PizZip = require('pizzip');

const data = $('Merge Fields').first().json;

// Download template
const downloadUrl = $('Get Download URL').first().json['@microsoft.graph.downloadUrl'];
const templateBuffer = await new Promise((resolve, reject) => {
  https.get(downloadUrl, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      https.get(res.headers.location, (r2) => {
        const c = []; r2.on('data', d => c.push(d)); r2.on('end', () => resolve(Buffer.concat(c))); r2.on('error', reject);
      }).on('error', reject);
      return;
    }
    const c = []; res.on('data', d => c.push(d)); res.on('end', () => resolve(Buffer.concat(c))); res.on('error', reject);
  }).on('error', reject);
});
console.log('Template: ' + templateBuffer.length + ' bytes');

// Build replacement map
const dash = (v) => (v && String(v).trim()) ? String(v).trim() : '\\u2014';

// Goals, actions, discussions — build display strings
const goalsList = [data.goal1, data.goal2, data.goal3].filter(g => g && g.trim());
const actionsList = [
  data.action1 ? { t: data.action1, o: data.action1Owner || '', d: data.action1Due || '' } : null,
  data.action2 ? { t: data.action2, o: data.action2Owner || '', d: data.action2Due || '' } : null,
  data.action3 ? { t: data.action3, o: data.action3Owner || '', d: data.action3Due || '' } : null,
].filter(Boolean);
const discList = [data.discussionPoint1, data.discussionPoint2, data.discussionPoint3].filter(d => d && d.trim());

const replacements = {
  'FIRM_NAME': data.firmName || '',
  'CLIENT_NAME': data.clientName || '',
  'REPORT_PERIOD': data.reportPeriod || '',
  'REPORT_DATE': data.reportDate || '',
  'ADVISOR_NAME': data.advisorName || '',
  'MEETING_DATE': data.meetingDate || '',
  'MEETING_LOCATION': data.meetingLocation || 'Zoom',
  'ATTENDEES': data.attendees || '',
  'MEETING_DURATION': data.meetingDuration || '',
  'PORTFOLIO_VALUE': data.portfolioValue || '',
  'YTD_RETURN': data.ytdReturn || '',
  'BENCHMARK_RETURN': data.benchmarkReturn || '',
  'VS_BENCHMARK': data.vsBenchmark || '',
  'ACCOUNT_NUMBER': data.accountNumber || '',
  'ACCOUNT_TYPE': dash(data.accountType),
  'RISK_PROFILE': dash(data.riskProfile),
  'TOP_HOLDING': dash(data.topHolding),
  'INVESTMENT_OBJECTIVE': dash(data.investmentObjective),
  'TIME_HORIZON': dash(data.timeHorizon),
  'BACKGROUND_INFO': dash(data.backgroundInfo),
  'NEXT_MEETING_DATE': dash(data.nextMeetingDate),
  'NEXT_MEETING_AGENDA': dash(data.nextMeetingAgenda),
  'ADVISOR_NOTES': data.advisorNotes || '',
  'GOALS_PROGRESS_NOTES': data.goalsProgressNotes || '',
};

console.log('Rendering: ' + data.clientName + ' | ' + data.portfolioValue);

// Open the docx ZIP and do string replacement on the XML
const zip = new PizZip(templateBuffer);
let xml = zip.file('word/document.xml').asText();

// Replace simple {{TAG}} placeholders
for (const [tag, value] of Object.entries(replacements)) {
  // Escape XML special chars in the value
  const safeValue = String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  xml = xml.split('{{' + tag + '}}').join(safeValue);
}

// Handle loop sections: {{#goals}}...{{/goals}}
// For goals: replace the loop block with rendered rows
const goalsBlock = xml.match(/\{\{#goals\}\}([\s\S]*?)\{\{\/goals\}\}/);
if (goalsBlock) {
  let goalsHtml = '';
  goalsList.forEach((g, i) => {
    let row = goalsBlock[1];
    row = row.split('{{num}}').join(String(i + 1));
    row = row.split('{{text}}').join(g.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;'));
    goalsHtml += row;
  });
  xml = xml.replace(goalsBlock[0], goalsHtml);
}

// For discussions: {{#discussions}}...{{/discussions}}
const discBlock = xml.match(/\{\{#discussions\}\}([\s\S]*?)\{\{\/discussions\}\}/);
if (discBlock) {
  let discHtml = '';
  discList.forEach((d, i) => {
    let row = discBlock[1];
    row = row.split('{{num}}').join(String(i + 1));
    row = row.split('{{text}}').join(d.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;'));
    discHtml += row;
  });
  xml = xml.replace(discBlock[0], discHtml);
}

// For actions: {{#actions}}...{{/actions}}
const actBlock = xml.match(/\{\{#actions\}\}([\s\S]*?)\{\{\/actions\}\}/);
if (actBlock) {
  let actHtml = '';
  actionsList.forEach((a, i) => {
    let row = actBlock[1];
    row = row.split('{{num}}').join(String(i + 1));
    row = row.split('{{text}}').join(a.t.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;'));
    row = row.split('{{owner}}').join(a.o.replace(/&/g, '&amp;'));
    row = row.split('{{due}}').join(a.d.replace(/&/g, '&amp;'));
    actHtml += row;
  });
  xml = xml.replace(actBlock[0], actHtml);
}

// Handle conditional sections: {{#FIELD}}...{{/FIELD}}
for (const tag of ['ADVISOR_NOTES', 'GOALS_PROGRESS_NOTES']) {
  const condBlock = xml.match(new RegExp('\\{\\{#' + tag + '\\}\\}([\\s\\S]*?)\\{\\{/' + tag + '\\}\\}'));
  if (condBlock) {
    const value = replacements[tag];
    if (value && value.trim()) {
      // Show the block with the value
      xml = xml.replace(condBlock[0], condBlock[1].split('{{' + tag + '}}').join(value.replace(/&/g, '&amp;').replace(/</g, '&lt;')));
    } else {
      // Hide the block
      xml = xml.replace(condBlock[0], '');
    }
  }
}

// Write back
zip.file('word/document.xml', xml);
const outputBuffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
const outputBase64 = outputBuffer.toString('base64');

console.log('Output: ' + outputBuffer.length + ' bytes');

const fileName = ((data.clientName || 'Report').replace(/[^a-zA-Z0-9\\s\\-]/g, '').trim() || 'Report') + ' - ' + ((data.reportPeriod || 'Report').replace(/[^a-zA-Z0-9\\s\\-]/g, '').trim() || 'Report') + '.docx';

return [{
  binary: {
    data: {
      data: outputBase64,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileName: fileName,
      fileExtension: 'docx'
    }
  },
  json: { fileName: fileName }
}];
`.trim();

async function update() {
  console.log('Fetching...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();

  const fill = wf.nodes.find(n => n.name === 'Fill Placeholders');
  fill.parameters.jsCode = FILL_CODE;
  console.log('Replaced with simple string replacement (no docxtemplater)');

  const cleanSettings = {};
  if (wf.settings?.executionOrder) cleanSettings.executionOrder = wf.settings.executionOrder;

  const putResp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: cleanSettings })
  });
  const result = await putResp.json();
  if (!result.id) { console.error('FAILED:', JSON.stringify(result).substring(0, 500)); process.exit(1); }
  await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}/activate`, {
    method: 'POST', headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  console.log('Activated');
}

update().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
