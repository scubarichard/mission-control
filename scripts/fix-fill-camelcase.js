/**
 * Fix Fill Placeholders — use camelCase tags matching the actual SharePoint template.
 * The template in SharePoint has {{camelCase}} tags, not {{UPPER_SNAKE}}.
 * Run: node scripts/fix-fill-camelcase.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = 'MtkxBYcyV1VYt02e';

const FILL_CODE = `const https = require('https');
const PizZip = require('pizzip');

const data = $('Merge Fields').first().json;
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

function esc(v) { return String(v).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;'); }
function dash(v) { return (v && String(v).trim()) ? String(v).trim() : '\\u2014'; }
function rt(xml, tag, value) { return xml.split('{{' + tag + '}}').join(esc(value)); }

const zip = new PizZip(templateBuffer);
let xml = zip.file('word/document.xml').asText();

// Replace ALL tag formats — camelCase (actual template) AND UPPER_SNAKE (just in case)
const fields = {
  firmName: data.firmName || '', clientName: data.clientName || '',
  reportPeriod: data.reportPeriod || '', reportDate: data.reportDate || '',
  advisorName: data.advisorName || '', meetingDate: data.meetingDate || '',
  meetingLocation: data.meetingLocation || 'Zoom', attendees: data.attendees || '',
  meetingDuration: data.meetingDuration || '', portfolioValue: data.portfolioValue || '',
  ytdReturn: data.ytdReturn || '', benchmarkReturn: data.benchmarkReturn || '',
  vsBenchmark: data.vsBenchmark || '', accountNumber: data.accountNumber || '',
  accountType: dash(data.accountType), riskProfile: dash(data.riskProfile),
  topHolding: dash(data.topHolding), investmentObjective: dash(data.investmentObjective),
  timeHorizon: dash(data.timeHorizon), backgroundInfo: dash(data.backgroundInfo),
  nextMeetingDate: dash(data.nextMeetingDate), nextMeetingAgenda: dash(data.nextMeetingAgenda),
  advisorNotes: data.advisorNotes || '', goalsProgressNotes: data.goalsProgressNotes || '',
  goal1: data.goal1 || '', goal2: data.goal2 || '', goal3: data.goal3 || '',
  discussionPoint1: data.discussionPoint1 || '', discussionPoint2: data.discussionPoint2 || '',
  discussionPoint3: data.discussionPoint3 || '',
  action1: data.action1 || '', action1Owner: data.action1Owner || '', action1Due: data.action1Due || '',
  action2: data.action2 || '', action2Owner: data.action2Owner || '', action2Due: data.action2Due || '',
  action3: data.action3 || '', action3Owner: data.action3Owner || '', action3Due: data.action3Due || '',
};

for (const [key, value] of Object.entries(fields)) {
  xml = rt(xml, key, value);
  // Also try UPPER_SNAKE version
  const upper = key.replace(/([A-Z])/g, '_$1').toUpperCase();
  xml = rt(xml, upper, value);
}

console.log('Rendered: ' + data.clientName + ' | ' + data.portfolioValue);

zip.file('word/document.xml', xml);
const outputBuffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
const outputBase64 = outputBuffer.toString('base64');
console.log('Output: ' + outputBuffer.length + ' bytes');

const cName = String(data.clientName || 'Report').replace(/[^a-zA-Z0-9 -]/g, '').trim() || 'Report';
const rPeriod = String(data.reportPeriod || 'Report').replace(/[^a-zA-Z0-9 -]/g, '').trim() || 'Report';
const fileName = cName + ' - ' + rPeriod + '.docx';

return [{
  binary: { data: { data: outputBase64, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fileName: fileName, fileExtension: 'docx' } },
  json: { fileName: fileName }
}];`;

async function update() {
  console.log('Fetching...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();
  wf.nodes.find(n => n.name === 'Fill Placeholders').parameters.jsCode = FILL_CODE;

  const cleanSettings = {};
  if (wf.settings?.executionOrder) cleanSettings.executionOrder = wf.settings.executionOrder;

  const r = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: cleanSettings })
  });
  const result = await r.json();
  if (!result.id) { console.error('FAILED:', JSON.stringify(result).substring(0, 500)); process.exit(1); }
  await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}/activate`, {
    method: 'POST', headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  console.log('Updated: camelCase tags + UPPER_SNAKE fallback');
}

update().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
