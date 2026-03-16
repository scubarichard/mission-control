const { execSync } = require('child_process');
const { MongoClient } = require('mongodb');
const conn = execSync('az keyvault secret show --vault-name kvdaxdakonapilot --name cosmos-connection-string --query value -o tsv', {encoding:'utf8'}).trim().replace(/^ERROR:\\s*/,'');
MongoClient.connect(conn).then(async c => {
  const db = c.db('librechat');
  const convos = await db.collection('conversations').find({}).sort({_id:-1}).limit(3).toArray();
  for (const convo of convos) {
    console.log('\nConvo:', convo.conversationId, '|', convo.title, '| updated:', convo.updatedAt);
    const msgs = await db.collection('messages').find({conversationId: convo.conversationId}).sort({_id:1}).toArray();
    msgs.forEach(m => {
      const role = m.role || m.sender;
      const content = m.content ? JSON.stringify(m.content).substring(0,300) : String(m.text||'').substring(0,200);
      const hasToolCalls = JSON.stringify(m.content||'').includes('tool_use') || m.tool_calls;
      console.log(' [' + role + ']', hasToolCalls ? '*** HAS_TOOL_CALLS ***' : '', content.substring(0,150));
    });
  }
  await c.close();
}).catch(e => console.error('ERR:', e.message));
