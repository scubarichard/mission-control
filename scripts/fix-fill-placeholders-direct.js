/**
 * Fix Fill Placeholders — render docxtemplater directly in Code node
 * instead of spawning a child process. The sandbox allows all builtins now.
 *
 * Run: node scripts/fix-fill-placeholders-direct.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = 'MtkxBYcyV1VYt02e';

const FILL_CODE = `
const https = require('https');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const data = $('Merge Fields').first().json;

// Download template
const downloadUrl = $('Get Download URL').first().json['@microsoft.graph.downloadUrl'];
console.log('Downloading template...');

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
if (templateBuffer.length < 1000) throw new Error('Template too small: ' + templateBuffer.length + ' bytes');

// Build templateData
const goals = [data.goal1, data.goal2, data.goal3]
  .filter(g => g && g.trim())
  .map((g, i) => ({ num: i + 1, text: g.trim() }));

const actions = [
  { text: data.action1, owner: data.action1Owner, due: data.action1Due },
  { text: data.action2, owner: data.action2Owner, due: data.action2Due },
  { text: data.action3, owner: data.action3Owner, due: data.action3Due },
].filter(a => a.text && a.text.trim())
 .map((a, i) => ({ num: i + 1, text: a.text.trim(), owner: a.owner || '', due: a.due || '' }));

const discussions = [data.discussionPoint1, data.discussionPoint2, data.discussionPoint3]
  .filter(d => d && d.trim())
  .map((d, i) => ({ num: i + 1, text: d.trim() }));

const dash = (v) => (v && String(v).trim()) ? String(v).trim() : '\\u2014';

const templateData = {
  FIRM_NAME: data.firmName || '',
  CLIENT_NAME: data.clientName || '',
  REPORT_PERIOD: data.reportPeriod || '',
  REPORT_DATE: data.reportDate || '',
  ADVISOR_NAME: data.advisorName || '',
  MEETING_DATE: data.meetingDate || '',
  MEETING_LOCATION: data.meetingLocation || 'Zoom',
  ATTENDEES: data.attendees || '',
  MEETING_DURATION: data.meetingDuration || '',
  ADVISOR_NOTES: data.advisorNotes || '',
  PORTFOLIO_VALUE: data.portfolioValue || '',
  YTD_RETURN: data.ytdReturn || '',
  BENCHMARK_RETURN: data.benchmarkReturn || '',
  VS_BENCHMARK: data.vsBenchmark || '',
  GOALS_PROGRESS_NOTES: data.goalsProgressNotes || '',
  NEXT_MEETING_DATE: dash(data.nextMeetingDate),
  NEXT_MEETING_AGENDA: dash(data.nextMeetingAgenda),
  ACCOUNT_NUMBER: data.accountNumber || '',
  ACCOUNT_TYPE: dash(data.accountType),
  RISK_PROFILE: dash(data.riskProfile),
  TOP_HOLDING: dash(data.topHolding),
  INVESTMENT_OBJECTIVE: dash(data.investmentObjective),
  TIME_HORIZON: dash(data.timeHorizon),
  BACKGROUND_INFO: dash(data.backgroundInfo),
  goals,
  actions,
  discussions,
};

console.log('Rendering: ' + templateData.CLIENT_NAME + ' | ' + templateData.PORTFOLIO_VALUE + ' | goals:' + goals.length + ' | actions:' + actions.length);

// Render directly — no child process
const zip = new PizZip(templateBuffer);
const doc = new Docxtemplater(zip, {
  delimiters: { start: '{{', end: '}}' },
  paragraphLoop: true,
  linebreaks: true,
  nullGetter(part) {
    if (!part.module) console.log('Unresolved tag: ' + part.value);
    return '';
  },
});
doc.render(templateData);
const outputBuffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
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
  console.log('Replaced Fill Placeholders — direct docxtemplater (no child process)');

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
