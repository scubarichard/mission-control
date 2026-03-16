const { execSync } = require('child_process');
const { MongoClient } = require('mongodb');
const conn = execSync('az keyvault secret show --vault-name kvdaxdakonapilot --name cosmos-connection-string --query value -o tsv', {encoding:'utf8'}).trim().replace(/^ERROR:\s*/,'');
const convId = process.argv[2] || '37d04811-7b7f-49a6-bef7-8b8632b4cdaf';
MongoClient.connect(conn).then(async c => {
  const db = c.db('librechat');
  const msgs = await db.collection('messages').find({conversationId: convId}).sort({_id:1}).toArray();
  console.log('Messages:', msgs.length, 'in convo', convId);
  msgs.forEach(m => {
    const role = m.role || m.sender;
    const content = m.content ? JSON.stringify(m.content).substring(0,500) : String(m.text||'').substring(0,200);
    console.log('[' + role + ']', content);
    if (m.tool_calls) console.log('  TOOL_CALLS:', JSON.stringify(m.tool_calls).substring(0,200));
  });
  await c.close();
}).catch(e => console.error('ERR:', e.message));
