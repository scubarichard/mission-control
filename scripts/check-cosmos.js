
const mongoose = require('mongoose');
const fs = require('fs');
const uri = process.env.MONGO_URI;

if (!uri) { fs.writeFileSync('C:/temp/cosmos_result.txt', 'NO MONGO_URI'); process.exit(1); }

mongoose.connect(uri).then(async () => {
  const db = mongoose.connection.db;
  const actions = await db.collection('actions').find({ agent_id: 'agent_dax_main' }).toArray();
  const agent = await db.collection('agents').findOne({ id: 'agent_dax_main' });
  
  let out = 'ACTIONS COUNT: ' + actions.length + '\n';
  actions.forEach(a => {
    out += '  action_id: ' + a.action_id + ' | domain: ' + (a.metadata && a.metadata.domain) + '\n';
  });
  if (agent) {
    out += 'AGENT TOOLS: ' + JSON.stringify(agent.tools) + '\n';
    out += 'AGENT ACTIONS: ' + JSON.stringify(agent.actions) + '\n';
  } else {
    out += 'AGENT NOT FOUND\n';
  }
  
  fs.writeFileSync('C:/temp/cosmos_result.txt', out);
  await mongoose.disconnect();
}).catch(e => fs.writeFileSync('C:/temp/cosmos_result.txt', 'ERR: ' + e.message));
