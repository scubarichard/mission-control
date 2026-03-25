/**
 * Add SharePoint document reading to Meeting Prep.
 * Checks client's DAX Reports folder for previously generated documents
 * and extracts key data from the latest quarterly review.
 * Run: node scripts/add-sharepoint-reading.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '3tniyxZREqfnAbfo';
const SITE_ID = 'dakonallc.sharepoint.com,68764500-f333-44cc-8017-30489a6a9053,71b1b423-6196-4e05-b004-7298445afb6f';

// SharePoint reading code — ES5 compatible, no optional chaining
const SP_READ_CODE = [
  '',
  '// SharePoint document history',
  'var spDocs = [];',
  'var prevReportSummary = "";',
  'if (gToken) {',
  '  var spFolderEncoded = "DAX%20Reports/" + encodeURIComponent(contact.name);',
  '  var spListPath = "/v1.0/sites/' + SITE_ID + '/drive/root:/" + spFolderEncoded + ":/children?$select=name,createdDateTime,size&$orderby=createdDateTime%20desc&$top=10";',
  '  var spData = await get("graph.microsoft.com", spListPath, { "Authorization": "Bearer " + gToken });',
  '  var spFiles = spData.value || [];',
  '  for (var sf = 0; sf < spFiles.length; sf++) {',
  '    var fDate = new Date(spFiles[sf].createdDateTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });',
  '    spDocs.push(fDate + " - " + spFiles[sf].name);',
  '  }',
  '',
  '  // Find most recent quarterly review to extract key data',
  '  var latestQR = null;',
  '  for (var sq = 0; sq < spFiles.length; sq++) {',
  '    if (spFiles[sq].name.indexOf("Quarterly") >= 0) { latestQR = spFiles[sq]; break; }',
  '  }',
  '',
  '  if (latestQR) {',
  '    var qrFilePath = "/v1.0/sites/' + SITE_ID + '/drive/root:/" + spFolderEncoded + "/" + encodeURIComponent(latestQR.name);',
  '    var qrMeta = await get("graph.microsoft.com", qrFilePath, { "Authorization": "Bearer " + gToken });',
  '    var qrDlUrl = qrMeta["@microsoft.graph.downloadUrl"] || "";',
  '    if (qrDlUrl) {',
  '      var qrParts = qrDlUrl.replace("https://", "").split("/");',
  '      var qrHost = qrParts.shift();',
  '      var qrUrlPath = "/" + qrParts.join("/");',
  '      var qrBuf = await new Promise(function(resolve) {',
  '        https.get({ hostname: qrHost, path: qrUrlPath }, function(res) {',
  '          var chunks = []; res.on("data", function(c2) { chunks.push(c2); }); res.on("end", function() { resolve(Buffer.concat(chunks)); });',
  '        }).on("error", function() { resolve(Buffer.alloc(0)); });',
  '      });',
  '      if (qrBuf.length > 1000) {',
  '        try {',
  '          var PizZipRead = require("pizzip");',
  '          var qrZip = new PizZipRead(qrBuf);',
  '          var qrXml = qrZip.file("word/document.xml").asText();',
  '          var qrText = qrXml.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/ +/g, " ").trim();',
  '          prevReportSummary = qrText.substring(0, 600);',
  '        } catch(qrErr) { /* ignore parse errors */ }',
  '      }',
  '    }',
  '  }',
  '}',
  '',
].join('\n');

async function deploy() {
  console.log('Fetching workflow...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();
  const prep = wf.nodes.find(n => n.name === 'Meeting Prep Tool');
  if (!prep) { console.error('Meeting Prep Tool node not found'); process.exit(1); }
  let code = prep.parameters.jsCode;

  // Idempotency check
  if (code.indexOf('SharePoint document history') >= 0) {
    console.log('SharePoint reading already present — skipping');
    return;
  }

  // Find insertion point: before talking points section
  var insertMarker = '// 5. Talking points';
  if (code.indexOf(insertMarker) < 0) {
    insertMarker = 'var tp = [';
  }
  if (code.indexOf(insertMarker) < 0) {
    console.error('Could not find talking points section to insert before');
    process.exit(1);
  }

  // Insert SharePoint reading code before talking points
  code = code.replace(insertMarker, SP_READ_CODE + insertMarker);
  console.log('  Inserted SharePoint document reading section');

  // Add PREVIOUS REPORTS section to the brief (before TALKING POINTS)
  code = code.replace(
    '"TALKING POINTS",',
    '"PREVIOUS REPORTS",\n  spDocs.length > 0 ? spDocs.join("\\n") : "No previous reports in SharePoint",\n  prevReportSummary ? "\\nLATEST QUARTERLY EXCERPT:\\n" + prevReportSummary : "",\n  "",\n  "TALKING POINTS",'
  );
  console.log('  Added PREVIOUS REPORTS section to brief');

  prep.parameters.jsCode = code;
  console.log('  Total code: ' + code.split('\n').length + ' lines');

  // Deploy
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
  console.log('  Activated — meeting prep now reads SharePoint documents');
}

deploy().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
