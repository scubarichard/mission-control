#!/bin/sh
# DAX custom entrypoint: fix indexes, migrate permissions, seed agent, start LibreChat
cd /app

echo "[DAX] Dropping Cosmos DB unique indexes on social provider fields..."
NODE_ENV=production node /app/patches/drop-unique-indexes.js 2>&1 || true

echo "[DAX] Running agent permissions migration..."
NODE_ENV=production node config/migrate-agent-permissions.js 2>&1 || true

echo "[DAX] Seeding document generator agent (replaceOne upsert)..."
NODE_ENV=production node /app/patches/seed-docgen-agent.js 2>&1 || true

echo "[DAX] Starting LibreChat..."
exec env NODE_ENV=production node \
    -r /app/patches/cosmos-compat.js \
    -r /app/patches/compliance-route.js \
    api/server/index.js "$@"
