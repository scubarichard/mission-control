/**
 * Fix Fill Placeholders — pure string replacement, zero regex.
 * Run: node scripts/fix-fill-string-only.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const WF_ID = 'MtkxBYcyV1VYt02e';

// The Code node content — uses ONLY split/join for replacements, zero regex
const FILL_CODE = [
  "const https = require('https');",
  "const PizZip = require('pizzip');",
  "",
  "const data = $('Merge Fields').first().json;",
  "const downloadUrl = $('Get Download URL').first().json['@microsoft.graph.downloadUrl'];",
  "",
  "const templateBuffer = await new Promise((resolve, reject) => {",
  "  https.get(downloadUrl, (res) => {",
  "    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {",
  "      https.get(res.headers.location, (r2) => {",
  "        const c = []; r2.on('data', d => c.push(d)); r2.on('end', () => resolve(Buffer.concat(c))); r2.on('error', reject);",
  "      }).on('error', reject);",
  "      return;",
  "    }",
  "    const c = []; res.on('data', d => c.push(d)); res.on('end', () => resolve(Buffer.concat(c))); res.on('error', reject);",
  "  }).on('error', reject);",
  "});",
  "console.log('Template: ' + templateBuffer.length + ' bytes');",
  "",
  "function esc(v) { return String(v).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;'); }",
  "function dash(v) { return (v && String(v).trim()) ? String(v).trim() : '\\u2014'; }",
  "",
  "// Simple tag replacer — no regex",
  "function replaceTag(xml, tag, value) {",
  "  return xml.split('{{' + tag + '}}').join(esc(value));",
  "}",
  "",
  "// Block replacer — finds {{#name}}...{{/name}} and replaces with rendered content",
  "function replaceBlock(xml, name, items, renderFn) {",
  "  const open = '{{#' + name + '}}';",
  "  const close = '{{/' + name + '}}';",
  "  const start = xml.indexOf(open);",
  "  if (start === -1) return xml;",
  "  const end = xml.indexOf(close, start);",
  "  if (end === -1) return xml;",
  "  const template = xml.substring(start + open.length, end);",
  "  let rendered = '';",
  "  for (const item of items) { rendered += renderFn(template, item); }",
  "  return xml.substring(0, start) + rendered + xml.substring(end + close.length);",
  "}",
  "",
  "// Conditional block — show content if value is truthy, hide if empty",
  "function conditionalBlock(xml, name, value) {",
  "  const open = '{{#' + name + '}}';",
  "  const close = '{{/' + name + '}}';",
  "  const start = xml.indexOf(open);",
  "  if (start === -1) return xml;",
  "  const end = xml.indexOf(close, start);",
  "  if (end === -1) return xml;",
  "  const inner = xml.substring(start + open.length, end);",
  "  if (value && String(value).trim()) {",
  "    return xml.substring(0, start) + inner.split('{{' + name + '}}').join(esc(value)) + xml.substring(end + close.length);",
  "  }",
  "  return xml.substring(0, start) + xml.substring(end + close.length);",
  "}",
  "",
  "const zip = new PizZip(templateBuffer);",
  "let xml = zip.file('word/document.xml').asText();",
  "",
  "// Replace all simple tags",
  "xml = replaceTag(xml, 'FIRM_NAME', data.firmName || '');",
  "xml = replaceTag(xml, 'CLIENT_NAME', data.clientName || '');",
  "xml = replaceTag(xml, 'REPORT_PERIOD', data.reportPeriod || '');",
  "xml = replaceTag(xml, 'REPORT_DATE', data.reportDate || '');",
  "xml = replaceTag(xml, 'ADVISOR_NAME', data.advisorName || '');",
  "xml = replaceTag(xml, 'MEETING_DATE', data.meetingDate || '');",
  "xml = replaceTag(xml, 'MEETING_LOCATION', data.meetingLocation || 'Zoom');",
  "xml = replaceTag(xml, 'ATTENDEES', data.attendees || '');",
  "xml = replaceTag(xml, 'MEETING_DURATION', data.meetingDuration || '');",
  "xml = replaceTag(xml, 'PORTFOLIO_VALUE', data.portfolioValue || '');",
  "xml = replaceTag(xml, 'YTD_RETURN', data.ytdReturn || '');",
  "xml = replaceTag(xml, 'BENCHMARK_RETURN', data.benchmarkReturn || '');",
  "xml = replaceTag(xml, 'VS_BENCHMARK', data.vsBenchmark || '');",
  "xml = replaceTag(xml, 'ACCOUNT_NUMBER', data.accountNumber || '');",
  "xml = replaceTag(xml, 'ACCOUNT_TYPE', dash(data.accountType));",
  "xml = replaceTag(xml, 'RISK_PROFILE', dash(data.riskProfile));",
  "xml = replaceTag(xml, 'TOP_HOLDING', dash(data.topHolding));",
  "xml = replaceTag(xml, 'INVESTMENT_OBJECTIVE', dash(data.investmentObjective));",
  "xml = replaceTag(xml, 'TIME_HORIZON', dash(data.timeHorizon));",
  "xml = replaceTag(xml, 'BACKGROUND_INFO', dash(data.backgroundInfo));",
  "xml = replaceTag(xml, 'NEXT_MEETING_DATE', dash(data.nextMeetingDate));",
  "xml = replaceTag(xml, 'NEXT_MEETING_AGENDA', dash(data.nextMeetingAgenda));",
  "",
  "// Replace loop blocks",
  "const goals = [data.goal1, data.goal2, data.goal3].filter(g => g && String(g).trim()).map((g, i) => ({ num: i+1, text: g }));",
  "xml = replaceBlock(xml, 'goals', goals, (tpl, item) => tpl.split('{{num}}').join(String(item.num)).split('{{text}}').join(esc(item.text)));",
  "",
  "const discussions = [data.discussionPoint1, data.discussionPoint2, data.discussionPoint3].filter(d => d && String(d).trim()).map((d, i) => ({ num: i+1, text: d }));",
  "xml = replaceBlock(xml, 'discussions', discussions, (tpl, item) => tpl.split('{{num}}').join(String(item.num)).split('{{text}}').join(esc(item.text)));",
  "",
  "const actions = [",
  "  data.action1 ? { t: data.action1, o: data.action1Owner || '', d: data.action1Due || '' } : null,",
  "  data.action2 ? { t: data.action2, o: data.action2Owner || '', d: data.action2Due || '' } : null,",
  "  data.action3 ? { t: data.action3, o: data.action3Owner || '', d: data.action3Due || '' } : null,",
  "].filter(Boolean).map((a, i) => ({ num: i+1, text: a.t, owner: a.o, due: a.d }));",
  "xml = replaceBlock(xml, 'actions', actions, (tpl, item) => tpl.split('{{num}}').join(String(item.num)).split('{{text}}').join(esc(item.text)).split('{{owner}}').join(esc(item.owner)).split('{{due}}').join(esc(item.due)));",
  "",
  "// Conditional blocks",
  "xml = conditionalBlock(xml, 'ADVISOR_NOTES', data.advisorNotes);",
  "xml = conditionalBlock(xml, 'GOALS_PROGRESS_NOTES', data.goalsProgressNotes);",
  "",
  "console.log('Rendered: ' + data.clientName + ' | ' + data.portfolioValue);",
  "",
  "zip.file('word/document.xml', xml);",
  "const outputBuffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });",
  "const outputBase64 = outputBuffer.toString('base64');",
  "console.log('Output: ' + outputBuffer.length + ' bytes');",
  "",
  "const cName = (data.clientName || 'Report').split('/').join('-').split('\\\\').join('-');",
  "const rPeriod = (data.reportPeriod || 'Report').split('/').join('-');",
  "const fileName = cName + ' - ' + rPeriod + '.docx';",
  "",
  "return [{",
  "  binary: { data: { data: outputBase64, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fileName: fileName, fileExtension: 'docx' } },",
  "  json: { fileName: fileName }",
  "}];",
].join('\n');

async function update() {
  console.log('Fetching...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();
  const fill = wf.nodes.find(n => n.name === 'Fill Placeholders');
  fill.parameters.jsCode = FILL_CODE;
  console.log('Replaced with pure string operations (zero regex)');

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

const N8N_URL = 'https://n8n.dakona.net';
update().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
