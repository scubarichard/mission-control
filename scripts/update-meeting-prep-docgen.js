/**
 * Update Meeting Prep Tool to generate Word doc + upload to SharePoint.
 * Run: node scripts/update-meeting-prep-docgen.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '3tniyxZREqfnAbfo';
const WB_KEY = '2565bf3734934e0facbe77c7c2accd40';
const GRAPH_TENANT = 'd2a3c346-00f3-47dd-a53e-caa3fca74714';
const GRAPH_CLIENT_ID = '218064ac-bee2-4246-9709-ae7518ae71cb';
const GRAPH_CLIENT_SECRET = '6LR8Q~ZCn5FTBlg894LtCGlXZ9GV3NAhS4BY9bla';
const SITE_ID = 'dakonallc.sharepoint.com,68764500-f333-44cc-8017-30489a6a9053,71b1b423-6196-4e05-b004-7298445afb6f';

// Read the current meeting prep code and append document generation
async function deploy() {
  console.log('Fetching...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();
  const prep = wf.nodes.find(n => n.name === 'Meeting Prep Tool');
  let code = prep.parameters.jsCode;

  // Find the "return brief;" at the end and replace with doc generation + brief return
  code = code.replace(
    'return brief;',
    `// ── Generate Word document and upload to SharePoint ──
var PizZip = require("pizzip");

// Get Graph token
var graphTokenBody = "client_id=${GRAPH_CLIENT_ID}&client_secret=${GRAPH_CLIENT_SECRET}&scope=https://graph.microsoft.com/.default&grant_type=client_credentials";
var graphTokenRes = await new Promise(function(resolve) {
  var req = https.request({ hostname: "login.microsoftonline.com", path: "/${GRAPH_TENANT}/oauth2/v2.0/token", method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(graphTokenBody) } }, function(res) {
    var d = ""; res.on("data", function(c) { d += c; }); res.on("end", function() { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
  });
  req.on("error", function() { resolve({}); });
  req.write(graphTokenBody); req.end();
});
var graphTok = graphTokenRes.access_token || "";

if (graphTok) {
  // Download template
  var tplMeta = await get("graph.microsoft.com", "/v1.0/sites/${SITE_ID}/drive/root:/DAX Templates/Meeting-Prep-TEMPLATE.docx", { "Authorization": "Bearer " + graphTok });
  var dlUrl = tplMeta["@microsoft.graph.downloadUrl"] || "";

  if (dlUrl) {
    var tplParts = dlUrl.replace("https://", "").split("/");
    var tplHost = tplParts.shift();
    var tplPath = "/" + tplParts.join("/");
    var tplBuf = await new Promise(function(resolve) {
      https.get({ hostname: tplHost, path: tplPath, headers: {} }, function(res) {
        var chunks = []; res.on("data", function(c) { chunks.push(c); }); res.on("end", function() { resolve(Buffer.concat(chunks)); });
      }).on("error", function() { resolve(Buffer.alloc(0)); });
    });

    if (tplBuf.length > 1000) {
      var zip = new PizZip(tplBuf);
      var xml = zip.file("word/document.xml").asText();

      function esc(v) { return String(v || "").split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;"); }

      var tpText = tp.map(function(p, i) { return (i + 1) + ". " + p; }).join("\\n");
      var actText = actions.length > 0 ? actions.map(function(a, i) { return (i + 1) + ". " + a; }).join("\\n") : "None";

      var replacements = {
        "clientName": esc(contact.name),
        "meetingDate": esc(new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })),
        "meetingTime": "",
        "accountNumber": esc(acct || "N/A"),
        "riskProfile": esc(risk),
        "investmentObjective": esc(obj),
        "timeHorizon": esc(hor),
        "tags": esc(tagList.join(", ") || "None"),
        "backgroundInfo": esc((bg || "").substring(0, 300)),
        "portfolioValue": "N/A",
        "topHolding": "N/A",
        "benchmarkToday": esc(spyInfo),
        "lastMeetingNotes": esc((noteContent || "No recent notes").substring(0, 500)),
        "action1": esc(actions[0] || "None"),
        "action2": esc(actions[1] || ""),
        "action3": esc(actions[2] || ""),
        "nextMeetingDate": esc(calInfo),
        "talkingPoints": esc(tpText),
        "advisorName": "Brett Stone",
        "reportDate": esc(new Date().toLocaleDateString("en-US"))
      };

      for (var tag in replacements) {
        xml = xml.split("{{" + tag + "}}").join(replacements[tag]);
      }

      zip.file("word/document.xml", xml);
      var docBuf = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });

      // Upload to SharePoint
      var clientClean = contact.name.replace(/[^a-zA-Z0-9 ]/g, "").trim();
      var dateStr = new Date().toISOString().split("T")[0];
      var fileName = clientClean.replace(/ /g, "_") + "_Meeting_Prep_" + dateStr + ".docx";
      var folderPath = "DAX Reports/" + contact.name;

      // Upload
      var uploadBody = docBuf;
      var uploadResult = await new Promise(function(resolve) {
        var uploadPath = "/v1.0/sites/${SITE_ID}/drive/root:/" + encodeURIComponent(folderPath) + "/" + encodeURIComponent(fileName) + ":/content";
        var req = https.request({ hostname: "graph.microsoft.com", path: uploadPath, method: "PUT", headers: { "Authorization": "Bearer " + graphTok, "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Length": uploadBody.length } }, function(res) {
          var d = ""; res.on("data", function(c) { d += c; }); res.on("end", function() { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
        });
        req.on("error", function() { resolve({}); });
        req.write(uploadBody); req.end();
      });

      if (uploadResult.webUrl) {
        brief += "\\n\\nMeeting prep document saved to SharePoint: " + folderPath + "/" + fileName;
      }
    }
  }
}

return brief;`
  );

  prep.parameters.jsCode = code;
  console.log('Updated Meeting Prep with doc generation');

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
  console.log('Activated');
}

deploy().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
