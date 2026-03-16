const { execSync } = require('child_process');
const { MongoClient } = require('mongodb');
const conn = execSync('az keyvault secret show --vault-name kvdaxdakonapilot --name cosmos-connection-string --query value -o tsv', {encoding:'utf8'}).trim().replace(/^ERROR:\s*/,'');
MongoClient.connect(conn).then(async c => {
  const db = c.db('librechat');
  const calls = await db.collection('toolcalls').find({}).sort({_id:-1}).limit(5).toArray();
  console.log('Recent toolcalls:', calls.length);
  calls.forEach(t => {
    console.log('  id:', t._id);
    console.log('  tool:', t.toolId || t.tool || JSON.stringify(Object.keys(t)));
    console.log('  output:', JSON.stringify(t).substring(0, 300));
    console.log('---');
  });
  await c.close();
}).catch(console.error);
