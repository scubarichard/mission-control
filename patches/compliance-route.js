/**
 * DAX Compliance Portal — Express routes.
 * Called from api/server/index.js: require('/app/patches/compliance-route.js')(app)
 */
var compliancePath = require('path');
var complianceHttps = require('https');

module.exports = function(app) {
  // Serve compliance.html at /compliance
  app.get('/compliance', function(req, res) {
    res.sendFile(compliancePath.join('/app/client/dist/compliance.html'));
  });

  // Data API — fetches DAX audit records from Wealthbox
  app.get('/compliance/data', function(req, res) {
    var token = req.query.token || req.headers['x-compliance-token'] || '';
    if (token !== 'dax-compliance-2026') return res.status(401).json({ error: 'Unauthorized' });

    var WB_TOKEN = process.env.WEALTHBOX_API_TOKEN || '';
    if (!WB_TOKEN) return res.status(500).json({ error: 'Not configured' });

    var allNotes = [];
    function fetchPage(pg) {
      complianceHttps.get({
        hostname: 'api.crmworkspace.com',
        path: '/v1/notes?per_page=100&page=' + pg,
        headers: { 'ACCESS_TOKEN': WB_TOKEN }
      }, function(apiRes) {
        var data = '';
        apiRes.on('data', function(c) { data += c; });
        apiRes.on('end', function() {
          try {
            var parsed = JSON.parse(data);
            var notes = (parsed.status_updates || []).filter(function(n) {
              return (n.content || '').indexOf('[DAX]') >= 0;
            });
            allNotes = allNotes.concat(notes);
            if ((parsed.status_updates || []).length === 100 && pg < 5) {
              fetchPage(pg + 1);
            } else {
              sendResponse();
            }
          } catch(e) { res.status(500).json({ error: 'Parse error' }); }
        });
      }).on('error', function() { res.status(500).json({ error: 'Connection error' }); });
    }

    function sendResponse() {
      var records = allNotes.map(function(n) {
        var content = n.content || '';
        var action = 'Unknown';
        if (content.indexOf('Quarterly Review') >= 0) action = 'Quarterly Review Generated';
        else if (content.indexOf('Meeting Prep') >= 0) action = 'Meeting Prep Brief';
        else if (content.indexOf('Client Profile') >= 0) action = 'Client Profile Accessed';
        else if (content.indexOf('Client List') >= 0) action = 'Client List Searched';
        var advisorMatch = content.match(/Advisor: (.+)/);
        var client = (n.linked_to && n.linked_to[0]) ? n.linked_to[0].name : 'Unknown';
        return {
          id: n.id, date: n.created_at, client: client, action: action,
          advisor: advisorMatch ? advisorMatch[1].trim() : 'Brett Stone',
          details: content.substring(0, 200), raw: content
        };
      }).sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
      res.json({ records: records, total: records.length });
    }

    fetchPage(1);
  });

  // ── GET /compliance/flags — read [DAX-REVIEW] notes from Wealthbox ──
  app.get('/compliance/flags', function(req, res) {
    var token = req.query.token || '';
    if (token !== 'dax-compliance-2026') return res.status(401).json({ error: 'Unauthorized' });
    var statusFilter = req.query.status || 'PENDING';
    var WB_TOKEN = process.env.WEALTHBOX_API_TOKEN || '';
    if (!WB_TOKEN) return res.status(500).json({ error: 'Not configured' });

    var allNotes = [];
    function fetchPage(pg) {
      complianceHttps.get({
        hostname: 'api.crmworkspace.com',
        path: '/v1/notes?per_page=100&page=' + pg,
        headers: { 'ACCESS_TOKEN': WB_TOKEN }
      }, function(apiRes) {
        var data = '';
        apiRes.on('data', function(c) { data += c; });
        apiRes.on('end', function() {
          try {
            var parsed = JSON.parse(data);
            var notes = (parsed.status_updates || []).filter(function(n) {
              return (n.content || '').indexOf('[DAX-REVIEW]') >= 0;
            });
            allNotes = allNotes.concat(notes);
            if ((parsed.status_updates || []).length === 100 && pg < 5) {
              fetchPage(pg + 1);
            } else { buildFlags(); }
          } catch(e) { res.status(500).json({ error: 'Parse error' }); }
        });
      }).on('error', function() { res.status(500).json({ error: 'Connection error' }); });
    }

    function buildFlags() {
      var flags = allNotes.map(function(n) {
        var c = n.content || '';
        var sevMatch = c.match(/Compliance Flag \u2014 (\w+)/); // em dash
        if (!sevMatch) sevMatch = c.match(/Compliance Flag -- (\w+)/);
        if (!sevMatch) sevMatch = c.match(/Compliance Flag - (\w+)/);
        var severity = sevMatch ? sevMatch[1] : 'MEDIUM';
        var statusMatch = c.match(/Status: (\w+)/);
        var status = statusMatch ? statusMatch[1] : 'PENDING';
        var advMatch = c.match(/Advisor: (.+)/);
        var convMatch = c.match(/Conversation: (.+)/);
        var triggerBlock = c.split('TRIGGERS:')[1] || '';
        var userBlock = (c.split('USER: ')[1] || '').split('\n\nDAX:')[0] || '';
        var daxBlock = (c.split('DAX: ')[1] || '').split('\n\nGenerated')[0] || '';
        var triggerLines = triggerBlock.split('\n\nUSER:')[0].trim().split('\n').filter(function(l) { return l.trim(); });
        var triggers = triggerLines.map(function(l) {
          var m = l.match(/\[(\w+)\] "([^"]+)" . (.+)/);
          return m ? { severity: m[1], phrase: m[2], reason: m[3] } : { severity: 'MEDIUM', phrase: l.trim(), reason: '' };
        });
        var client = (n.linked_to && n.linked_to[0]) ? n.linked_to[0].name : 'Unknown';
        return {
          id: 'flag-' + n.id,
          noteId: n.id,
          timestamp: n.created_at,
          severity: severity,
          status: status,
          advisorName: advMatch ? advMatch[1].trim() : 'Brett Stone',
          clientName: client,
          conversationId: convMatch ? convMatch[1].trim() : '',
          triggers: triggers,
          userMessage: userBlock.trim(),
          daxResponse: daxBlock.trim(),
          reviewerNote: '',
          raw: c
        };
      }).sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });

      if (statusFilter !== 'all') {
        flags = flags.filter(function(f) { return f.status === statusFilter; });
      }
      res.json({ flags: flags, total: flags.length });
    }

    fetchPage(1);
  });

  // ── POST /compliance/flag-update — update flag status via Wealthbox ──
  app.post('/compliance/flag-update', function(req, res) {
    var body = '';
    req.on('data', function(c) { body += c; });
    req.on('end', function() {
      try {
        var parsed = JSON.parse(body);
        if (parsed.token !== 'dax-compliance-2026') return res.status(401).json({ error: 'Unauthorized' });
        var WB_TOKEN = process.env.WEALTHBOX_API_TOKEN || '';
        // Post a status update note linked to the original flag
        var ts = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
        var updateContent = '[DAX-REVIEW-UPDATE] Flag ' + parsed.flagId + ' — Status changed to ' + parsed.status +
          '\nDate: ' + ts + '\nReviewed by: ' + (parsed.reviewedBy || 'CCO') +
          '\nNote: ' + (parsed.reviewerNote || 'No notes') + '\nGenerated by DAX v0.5.0';
        var noteBody = JSON.stringify({ content: updateContent, tags: [{ name: 'DAX' }, { name: 'DAX-REVIEW' }] });
        var postReq = complianceHttps.request({
          hostname: 'api.crmworkspace.com', path: '/v1/notes', method: 'POST',
          headers: { 'ACCESS_TOKEN': WB_TOKEN, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(noteBody) }
        }, function(apiRes) {
          var data = ''; apiRes.on('data', function(c) { data += c; });
          apiRes.on('end', function() { res.json({ success: true, status: parsed.status }); });
        });
        postReq.on('error', function() { res.status(500).json({ error: 'Failed to update' }); });
        postReq.write(noteBody); postReq.end();
      } catch(e) { res.status(400).json({ error: 'Invalid JSON' }); }
    });
  });

  // ── GET /compliance/triggers — custom triggers (in-memory for pilot) ─
  var customTriggers = [];
  app.get('/compliance/triggers', function(req, res) {
    var token = req.query.token || '';
    if (token !== 'dax-compliance-2026') return res.status(401).json({ error: 'Unauthorized' });
    res.json({ triggers: customTriggers });
  });

  // ── POST /compliance/triggers — add/remove custom triggers ──────────
  app.post('/compliance/triggers', function(req, res) {
    var body = '';
    req.on('data', function(c) { body += c; });
    req.on('end', function() {
      try {
        var parsed = JSON.parse(body);
        if (parsed.token !== 'dax-compliance-2026') return res.status(401).json({ error: 'Unauthorized' });
        if (parsed.action === 'add' && parsed.phrase) {
          customTriggers.push({ phrase: parsed.phrase, severity: parsed.severity || 'MEDIUM', reason: parsed.reason || 'Custom firm trigger' });
          res.json({ success: true, triggers: customTriggers });
        } else if (parsed.action === 'remove' && parsed.phrase) {
          customTriggers = customTriggers.filter(function(t) { return t.phrase !== parsed.phrase; });
          res.json({ success: true, triggers: customTriggers });
        } else {
          res.json({ triggers: customTriggers });
        }
      } catch(e) { res.status(400).json({ error: 'Invalid JSON' }); }
    });
  });

  console.log('[DAX] Compliance portal registered at /compliance (with flagging proxy)');
};
