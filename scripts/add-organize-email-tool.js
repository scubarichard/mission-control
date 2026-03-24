/**
 * Add organize_email Code tool to AI Agent.
 * Creates folders, moves emails, marks read/unread, flags, archives.
 * Run: node scripts/add-organize-email-tool.js
 */
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';
const WF_ID = '3tniyxZREqfnAbfo';
const GRAPH_TENANT = 'd2a3c346-00f3-47dd-a53e-caa3fca74714';
const GRAPH_CLIENT_ID = '218064ac-bee2-4246-9709-ae7518ae71cb';
const GRAPH_CLIENT_SECRET = '6LR8Q~ZCn5FTBlg894LtCGlXZ9GV3NAhS4BY9bla';

const ORGANIZE_CODE = `var https = require("https");
var input = $input.all()[0].json || {};
var userText = (input.userText || input.query || "").toLowerCase();

function graphRequest(method, path, body) {
  return new Promise(function(resolve) {
    var bodyStr = body ? JSON.stringify(body) : "";
    var opts = {
      hostname: "graph.microsoft.com",
      path: path.split(" ").join("%20"),
      method: method,
      headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" }
    };
    if (bodyStr) opts.headers["Content-Length"] = Buffer.byteLength(bodyStr);
    var req = https.request(opts, function(res) {
      var d = ""; res.on("data", function(c) { d += c; });
      res.on("end", function() { try { resolve(JSON.parse(d)); } catch(e) { resolve({ raw: d, status: res.statusCode }); } });
    });
    req.on("error", function(e) { resolve({ error: e.message }); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// Get token
var tokenBody = "client_id=${GRAPH_CLIENT_ID}&client_secret=${GRAPH_CLIENT_SECRET}&scope=https://graph.microsoft.com/.default&grant_type=client_credentials";
var tokenRes = await new Promise(function(resolve) {
  var req = https.request({ hostname: "login.microsoftonline.com", path: "/${GRAPH_TENANT}/oauth2/v2.0/token", method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(tokenBody) } }, function(res) {
    var d = ""; res.on("data", function(c) { d += c; }); res.on("end", function() { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
  });
  req.on("error", function() { resolve({}); });
  req.write(tokenBody); req.end();
});
var token = tokenRes.access_token || "";
if (!token) return "Could not connect to email. Please try again.";

var base = "/v1.0/users/richard@dakona.com";

// Parse action from user text
var action = "";
if (userText.indexOf("list folder") >= 0 || userText.indexOf("show folder") >= 0 || userText.indexOf("my folder") >= 0) action = "list_folders";
else if (userText.indexOf("create folder") >= 0 || userText.indexOf("new folder") >= 0 || userText.indexOf("make folder") >= 0) action = "create_folder";
else if (userText.indexOf("move") >= 0) action = "move_emails";
else if (userText.indexOf("mark") >= 0 && userText.indexOf("read") >= 0 && userText.indexOf("unread") < 0) action = "mark_read";
else if (userText.indexOf("mark") >= 0 && userText.indexOf("unread") >= 0) action = "mark_unread";
else if (userText.indexOf("flag") >= 0 && userText.indexOf("unflag") < 0) action = "flag";
else if (userText.indexOf("unflag") >= 0) action = "unflag";
else if (userText.indexOf("archive") >= 0) action = "archive";
else if (userText.indexOf("organize") >= 0 && userText.indexOf("client") >= 0) action = "organize_by_client";
else action = "list_folders";

// LIST FOLDERS
if (action === "list_folders") {
  var foldersRes = await graphRequest("GET", base + "/mailFolders?$select=displayName,totalItemCount,unreadItemCount", null);
  var folders = (foldersRes.value || []).filter(function(f) { return f.totalItemCount > 0; });
  var list = folders.map(function(f) { return "- " + f.displayName + " (" + f.totalItemCount + " emails, " + f.unreadItemCount + " unread)"; }).join("\\n");
  return "Your email folders:\\n\\n" + list;
}

// CREATE FOLDER
if (action === "create_folder") {
  var folderName = userText.replace(/create folder|new folder|make folder|called|named/gi, "").replace(/['"]/g, "").trim();
  if (!folderName) return "Please specify a folder name.";
  folderName = folderName.charAt(0).toUpperCase() + folderName.slice(1);
  var created = await graphRequest("POST", base + "/mailFolders", { displayName: folderName });
  if (created.id) return "Created folder: " + folderName;
  return "Could not create folder. It may already exist.";
}

// MARK READ / MARK UNREAD
if (action === "mark_read" || action === "mark_unread") {
  var isRead = action === "mark_read";
  var searchFilter = "";
  if (!isRead) searchFilter = "isRead%20eq%20true";
  else searchFilter = "isRead%20eq%20false";
  var msgs = await graphRequest("GET", base + "/mailFolders/inbox/messages?$top=20&$select=id,subject&$filter=" + searchFilter, null);
  var toUpdate = msgs.value || [];
  if (toUpdate.length === 0) return "No emails to " + (isRead ? "mark as read" : "mark as unread") + ".";
  var updated = 0;
  for (var i = 0; i < Math.min(toUpdate.length, 20); i++) {
    await graphRequest("PATCH", base + "/messages/" + toUpdate[i].id, { isRead: isRead });
    updated++;
  }
  return "Marked " + updated + " email" + (updated !== 1 ? "s" : "") + " as " + (isRead ? "read" : "unread") + ".";
}

// ARCHIVE
if (action === "archive") {
  // Get or create Archive folder
  var allFolders = await graphRequest("GET", base + "/mailFolders?$select=id,displayName", null);
  var archiveFolder = (allFolders.value || []).find(function(f) { return f.displayName === "Archive"; });
  if (!archiveFolder) {
    archiveFolder = await graphRequest("POST", base + "/mailFolders", { displayName: "Archive" });
  }
  if (!archiveFolder || !archiveFolder.id) return "Could not find or create Archive folder.";

  var readMsgs = await graphRequest("GET", base + "/mailFolders/inbox/messages?$top=20&$select=id,subject&$filter=isRead%20eq%20true&$orderby=receivedDateTime%20asc", null);
  var toArchive = readMsgs.value || [];
  if (toArchive.length === 0) return "No read emails to archive.";
  var archived = 0;
  for (var j = 0; j < toArchive.length; j++) {
    await graphRequest("POST", base + "/messages/" + toArchive[j].id + "/move", { destinationId: archiveFolder.id });
    archived++;
  }
  return "Archived " + archived + " read email" + (archived !== 1 ? "s" : "") + ".";
}

// FLAG
if (action === "flag" || action === "unflag") {
  var flagStatus = action === "flag" ? "flagged" : "notFlagged";
  var flagMsgs = await graphRequest("GET", base + "/mailFolders/inbox/messages?$top=10&$select=id,subject&$orderby=receivedDateTime%20desc", null);
  var toFlag = (flagMsgs.value || []).slice(0, 5);
  var flagged = 0;
  for (var k = 0; k < toFlag.length; k++) {
    await graphRequest("PATCH", base + "/messages/" + toFlag[k].id, { flag: { flagStatus: flagStatus } });
    flagged++;
  }
  return (action === "flag" ? "Flagged" : "Unflagged") + " " + flagged + " email" + (flagged !== 1 ? "s" : "") + ".";
}

return "I can help with: list folders, create folders, mark read/unread, flag/unflag, archive read emails, or organize by client. What would you like to do?";`;

async function deploy() {
  console.log('Fetching...');
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();

  wf.nodes.push({
    parameters: {
      name: 'organize_email',
      description: 'Organizes the advisor\'s Exchange email. Use when asked to: create email folders, move emails, mark emails as read or unread, flag or unflag emails, archive read emails, list email folders, or organize inbox. NEVER delete emails — only archive or move.',
      jsCode: ORGANIZE_CODE
    },
    id: 'tool-organize-001',
    name: 'Organize Email Tool',
    type: '@n8n/n8n-nodes-langchain.toolCode',
    typeVersion: 1,
    position: [2200, 520]
  });
  wf.connections['Organize Email Tool'] = {
    ai_tool: [[{ node: 'DAX Agent', type: 'ai_tool', index: 0 }]]
  };
  console.log('  Added organize_email tool');

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
  console.log('  Activated. 8 tools total.');
}

deploy().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
