/**
 * Complete rewrite of Fill Placeholders — clean, handles ALL tag formats.
 * Run: node scripts/fix-fill-complete-rewrite.js
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

function esc(v) { return String(v || '').split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;'); }
function dash(v) { return (v && String(v).trim()) ? String(v).trim() : '\\u2014'; }

const zip = new PizZip(templateBuffer);
let xml = zip.file('word/document.xml').asText();

// All fields with their values
const d = data;
const map = {
  FIRM_NAME: d.firmName || '', CLIENT_NAME: d.clientName || '',
  REPORT_PERIOD: d.reportPeriod || '', REPORT_DATE: d.reportDate || '',
  ADVISOR_NAME: d.advisorName || '', MEETING_DATE: d.meetingDate || '',
  MEETING_LOCATION: d.meetingLocation || 'Zoom', ATTENDEES: d.attendees || '',
  MEETING_DURATION: d.meetingDuration || '', PORTFOLIO_VALUE: d.portfolioValue || '',
  YTD_RETURN: d.ytdReturn || '', BENCHMARK_RETURN: d.benchmarkReturn || '',
  VS_BENCHMARK: d.vsBenchmark || '', ACCOUNT_NUMBER: d.accountNumber || '',
  ACCOUNT_TYPE: dash(d.accountType), RISK_PROFILE: dash(d.riskProfile),
  TOP_HOLDING: dash(d.topHolding), INVESTMENT_OBJECTIVE: dash(d.investmentObjective),
  TIME_HORIZON: dash(d.timeHorizon), BACKGROUND_INFO: dash(d.backgroundInfo),
  NEXT_MEETING_DATE: dash(d.nextMeetingDate), NEXT_MEETING_AGENDA: dash(d.nextMeetingAgenda),
  ADVISOR_NOTES: d.advisorNotes || '', GOALS_PROGRESS_NOTES: d.goalsProgressNotes || '',
  GOAL_1: d.goal1 || '', GOAL_2: d.goal2 || '', GOAL_3: d.goal3 || '',
  DISCUSSION_POINT_1: d.discussionPoint1 || '', DISCUSSION_POINT_2: d.discussionPoint2 || '',
  DISCUSSION_POINT_3: d.discussionPoint3 || '',
  ACTION_1: d.action1 || '', ACTION_1_OWNER: d.action1Owner || '', ACTION_1_DUE: d.action1Due || '',
  ACTION_2: d.action2 || '', ACTION_2_OWNER: d.action2Owner || '', ACTION_2_DUE: d.action2Due || '',
  ACTION_3: d.action3 || '', ACTION_3_OWNER: d.action3Owner || '', ACTION_3_DUE: d.action3Due || '',
};

// Replace UPPER_SNAKE tags
for (const [tag, value] of Object.entries(map)) {
  xml = xml.split('{{' + tag + '}}').join(esc(value));
}

// Also replace camelCase tags (in case template has those)
const camelMap = {
  firmName: map.FIRM_NAME, clientName: map.CLIENT_NAME, reportPeriod: map.REPORT_PERIOD,
  reportDate: map.REPORT_DATE, advisorName: map.ADVISOR_NAME, meetingDate: map.MEETING_DATE,
  meetingLocation: map.MEETING_LOCATION, attendees: map.ATTENDEES,
  meetingDuration: map.MEETING_DURATION, portfolioValue: map.PORTFOLIO_VALUE,
  ytdReturn: map.YTD_RETURN, benchmarkReturn: map.BENCHMARK_RETURN,
  vsBenchmark: map.VS_BENCHMARK, accountNumber: map.ACCOUNT_NUMBER,
  accountType: map.ACCOUNT_TYPE, riskProfile: map.RISK_PROFILE,
  topHolding: map.TOP_HOLDING, investmentObjective: map.INVESTMENT_OBJECTIVE,
  timeHorizon: map.TIME_HORIZON, backgroundInfo: map.BACKGROUND_INFO,
  nextMeetingDate: map.NEXT_MEETING_DATE, nextMeetingAgenda: map.NEXT_MEETING_AGENDA,
  advisorNotes: map.ADVISOR_NOTES, goalsProgressNotes: map.GOALS_PROGRESS_NOTES,
  goal1: map.GOAL_1, goal2: map.GOAL_2, goal3: map.GOAL_3,
  discussionPoint1: map.DISCUSSION_POINT_1, discussionPoint2: map.DISCUSSION_POINT_2,
  discussionPoint3: map.DISCUSSION_POINT_3,
  action1: map.ACTION_1, action1Owner: map.ACTION_1_OWNER, action1Due: map.ACTION_1_DUE,
  action2: map.ACTION_2, action2Owner: map.ACTION_2_OWNER, action2Due: map.ACTION_2_DUE,
  action3: map.ACTION_3, action3Owner: map.ACTION_3_OWNER, action3Due: map.ACTION_3_DUE,
};
for (const [tag, value] of Object.entries(camelMap)) {
  xml = xml.split('{{' + tag + '}}').join(esc(value));
}

// Handle loop blocks: {{#name}}template{{/name}} → render for each item or remove if empty
function replaceBlock(xml, name, items, renderFn) {
  const open = '{{#' + name + '}}';
  const close = '{{/' + name + '}}';
  const start = xml.indexOf(open);
  if (start === -1) return xml;
  const end = xml.indexOf(close, start);
  if (end === -1) return xml;
  const tpl = xml.substring(start + open.length, end);
  let rendered = '';
  for (const item of items) rendered += renderFn(tpl, item);
  return xml.substring(0, start) + rendered + xml.substring(end + close.length);
}

// Handle conditional blocks: {{#NAME}}content{{NAME}}more{{/NAME}}
function conditionalBlock(xml, name, value) {
  const open = '{{#' + name + '}}';
  const close = '{{/' + name + '}}';
  const start = xml.indexOf(open);
  if (start === -1) return xml;
  const end = xml.indexOf(close, start);
  if (end === -1) return xml;
  const inner = xml.substring(start + open.length, end);
  if (value && String(value).trim()) {
    return xml.substring(0, start) + inner.split('{{' + name + '}}').join(esc(value)) + xml.substring(end + close.length);
  }
  return xml.substring(0, start) + xml.substring(end + close.length);
}

// Goals loop
const goals = [d.goal1, d.goal2, d.goal3].filter(g => g && String(g).trim()).map((g, i) => ({ num: i + 1, text: g }));
xml = replaceBlock(xml, 'goals', goals, (tpl, item) => tpl.split('{{num}}').join(String(item.num)).split('{{text}}').join(esc(item.text)));

// Discussions loop
const discussions = [d.discussionPoint1, d.discussionPoint2, d.discussionPoint3].filter(x => x && String(x).trim()).map((x, i) => ({ num: i + 1, text: x }));
xml = replaceBlock(xml, 'discussions', discussions, (tpl, item) => tpl.split('{{num}}').join(String(item.num)).split('{{text}}').join(esc(item.text)));

// Actions loop
const actions = [
  d.action1 ? { t: d.action1, o: d.action1Owner || '', du: d.action1Due || '' } : null,
  d.action2 ? { t: d.action2, o: d.action2Owner || '', du: d.action2Due || '' } : null,
  d.action3 ? { t: d.action3, o: d.action3Owner || '', du: d.action3Due || '' } : null,
].filter(Boolean).map((a, i) => ({ num: i + 1, text: a.t, owner: a.o, due: a.du }));
xml = replaceBlock(xml, 'actions', actions, (tpl, item) => tpl.split('{{num}}').join(String(item.num)).split('{{text}}').join(esc(item.text)).split('{{owner}}').join(esc(item.owner)).split('{{due}}').join(esc(item.due)));

// Conditional blocks
xml = conditionalBlock(xml, 'ADVISOR_NOTES', d.advisorNotes);
xml = conditionalBlock(xml, 'GOALS_PROGRESS_NOTES', d.goalsProgressNotes);

console.log('Rendered: ' + d.clientName + ' | ' + d.portfolioValue + ' | top: ' + d.topHolding);

zip.file('word/document.xml', xml);
const outputBuffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
const outputBase64 = outputBuffer.toString('base64');

const cName = String(d.clientName || 'Report').replace(/[^a-zA-Z0-9 -]/g, '').trim() || 'Report';
const rPeriod = String(d.reportPeriod || 'Report').replace(/[^a-zA-Z0-9 -]/g, '').trim() || 'Report';
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

  const fill = wf.nodes.find(n => n.name === 'Fill Placeholders');
  fill.parameters.jsCode = FILL_CODE;
  console.log('Complete rewrite deployed');

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
  console.log('Activated');
}

update().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
