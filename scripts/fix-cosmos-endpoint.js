const { MongoClient } = require('mongodb');

const CONN = 'mongodb://cosmos-dax-dakona-pilot:uH4yWzAqgQXyy9JQghlPUp2MhbwZ1KoSbCm8oxxGoMB4Ve3lKJ34iNjYSdKPTvTqBLFUbTGqo2L4ACDbNY3Utg==@cosmos-dax-dakona-pilot.mongo.cosmos.azure.com:10255/librechat?ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000';

async function main() {
  const client = new MongoClient(CONN);
  await client.connect();
  const db = client.db('librechat');

  // 1. Set defaultEndpoint to DAX for ALL users
  const r1 = await db.collection('users').updateMany(
    {},
    { $set: { 
      defaultEndpoint: 'DAX',
      'defaultSettings.endpoint': 'DAX',
      'defaultSettings.model': 'DAX Assistant'
    }}
  );
  console.log('Users updated with defaultEndpoint=DAX:', r1.modifiedCount);

  // 2. Update ALL conversations to DAX endpoint
  const r2 = await db.collection('conversations').updateMany(
    { endpoint: { $ne: 'DAX' } },
    { $set: { endpoint: 'DAX', model: 'DAX Assistant' }, $unset: { agentOptions: '', agentId: '' } }
  );
  console.log('Conversations updated to DAX:', r2.modifiedCount);

  // 3. Delete any remaining agent records
  const r3 = await db.collection('agents').deleteMany({});
  console.log('Agents deleted:', r3.deletedCount);

  // 4. Verify
  const sample = await db.collection('users').find({}, { projection: { email: 1, defaultEndpoint: 1 } }).limit(3).toArray();
  console.log('Sample users:', JSON.stringify(sample));

  await client.close();
  console.log('DONE');
}

main().catch(e => console.error('ERROR:', e.message));
