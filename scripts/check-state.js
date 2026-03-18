const { MongoClient } = require('mongodb');

// Fix the Fill Placeholders node filename in the DAX Document Generator
// The node uses data.CLIENT_NAME but data has clientName (camelCase)

const CONN = 'mongodb://cosmos-dax-dakona-pilot:uH4yWzAqgQXyy9JQghlPUp2MhbwZ1KoSbCm8oxxGoMB4Ve3lKJ34iNjYSdKPTvTqBLFUbTGqo2L4ACDbNY3Utg==@cosmos-dax-dakona-pilot.mongo.cosmos.azure.com:10255/librechat?ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000';

async function main() {
  const client = new MongoClient(CONN);
  await client.connect();
  const db = client.db('librechat');
  
  // Check current state
  const convos = await db.collection('conversations').find(
    {}, 
    { projection: { endpoint: 1, model: 1 } }
  ).limit(5).toArray();
  console.log('Current conversation endpoints:', JSON.stringify(convos.map(c => ({ endpoint: c.endpoint, model: c.model }))));
  
  await client.close();
  console.log('DONE');
}

main().catch(e => console.error('ERROR:', e.message));
