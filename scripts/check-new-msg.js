const { execSync } = require('child_process');
const { MongoClient } = require('mongodb');
const conn = execSync('az keyvault secret show --vault-name kvdaxdakonapilot --name cosmos-connection-string --query value -o tsv', {encoding:'utf8'}).trim().replace(/^ERROR:\\s*/,'');
MongoClient.connect(conn).then(async c => {
  const db = c.db('librechat');
  // Get latest conversation
  const convos = await db.collection('conversations').find({}).sort({_id:-1}).limit(1).toArray();
  console.log('Latest convo:', convos[0]?.conversationId, convos[0]?.title);
  const msgs = await db.collection('messages').find({conversationId: convos[0]?.conversationId}).sort({_id:1}).toArray();
  msgs.forEach(m => {
    const role = m.role || m.sender;
    const content = m.content ? JSON.stringify(m.content).substring(0,400) : String(m.text).substring(0,200);
    console.log('[' + role + ']', content);
    if (m.tool_calls) console.log('  TOOL_CALLS:', JSON.stringify(m.tool_calls));
  });
  await c.close();
}).catch(console.error);
