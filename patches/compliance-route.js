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

  console.log('[DAX] Compliance portal registered at /compliance');
};
