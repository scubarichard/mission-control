const { execSync } = require('child_process');
const { MongoClient } = require('mongodb');
const conn = execSync('az keyvault secret show --vault-name kvdaxdakonapilot --name cosmos-connection-string --query value -o tsv', {encoding:'utf8'}).trim().replace(/^ERROR:\\s*/,'');
MongoClient.connect(conn).then(async c => {
  const db = c.db('librechat');

  // Check the action document in full
  const action = await db.collection('actions').findOne({ agent_id: 'agent_dax_main' });
  if (!action) {
    console.log('NO ACTION FOUND for agent_dax_main');
    // Show all actions
    const all = await db.collection('actions').find({}).toArray();
    console.log('All actions:', all.map(a => ({action_id: a.action_id, agent_id: a.agent_id, domain: a.metadata?.domain})));
  } else {
    console.log('Action found:', action.action_id);
    console.log('agent_id:', action.agent_id);
    console.log('domain:', action.metadata?.domain);
    console.log('auth type:', action.metadata?.auth?.type);
    const yaml = require('js-yaml');
    const spec = yaml.load(action.metadata.raw_spec);
    console.log('spec version:', spec.info.version);
    console.log('paths:', Object.keys(spec.paths));
    const genOp = spec.paths['/webhook/generate-document']?.post;
    console.log('x-strict on generateICPReview:', genOp?.['x-strict']);
    console.log('operationId:', genOp?.operationId);
  }

  // Check agent tools array
  const agent = await db.collection('agents').findOne({ id: 'agent_dax_main' });
  console.log('\nAgent tools:', agent?.tools);

  await c.close();
}).catch(e => console.error('ERR:', e.message));
