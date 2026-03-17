const { MongoClient } = require('mongodb');

const CONN = 'mongodb://cosmos-dax-dakona-pilot:uH4yWzAqgQXyy9JQghlPUp2MhbwZ1KoSbCm8oxxGoMB4Ve3lKJ34iNjYSdKPTvTqBLFUbTGqo2L4ACDbNY3Utg==@cosmos-dax-dakona-pilot.mongo.cosmos.azure.com:10255/librechat?ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000';

async function main() {
  const client = new MongoClient(CONN);
  await client.connect();
  const db = client.db('librechat');

  // Update ALL conversations to use DAX custom endpoint
  const r1 = await db.collection('conversations').updateMany(
    { endpoint: { $ne: 'DAX' } },
    { $set: { endpoint: 'DAX', model: 'DAX Assistant' }, $unset: { agentOptions: '', agent_id: '' } }
  );
  console.log('All conversations updated to DAX endpoint:', r1.modifiedCount);

  // Check the user model_specs cache collections
  const collections = await db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name).join(', '));

  await client.close();
  console.log('DONE');
}

main().catch(e => console.error('ERROR:', e.message));
