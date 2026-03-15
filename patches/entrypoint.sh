#!/bin/sh
# DAX custom entrypoint: fix indexes, migrate permissions, seed agent, start LibreChat
cd /app

echo "[DAX] Dropping Cosmos DB unique indexes on social provider fields..."
NODE_ENV=production node /app/patches/drop-unique-indexes.js 2>&1 || true

echo "[DAX] Running agent permissions migration..."
NODE_ENV=production node config/migrate-agent-permissions.js 2>&1 || true

echo "[DAX] Deleting old agent to force reseed with correct model name..."
NODE_ENV=production node -e "
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(process.env.MONGO_URI);
  client.connect().then(async () => {
    const db = client.db();
    const r = await db.collection('agents').deleteOne({id: 'agent_dax_main'});
    if (r.deletedCount) console.log('[DAX] Deleted old agent_dax_main');
    else console.log('[DAX] No old agent to delete');
    await client.close();
  }).catch(e => { console.log('[DAX] Delete skip:', e.message); });
" 2>&1 || true

echo "[DAX] Seeding document generator agent..."
NODE_ENV=production node /app/patches/seed-docgen-agent.js 2>&1 || true

echo "[DAX] Starting LibreChat (with Cosmos DB $bitsAllSet compat layer)..."
exec env NODE_ENV=production node -r /app/patches/cosmos-compat.js api/server/index.js "$@"
