#!/bin/sh
# DAX custom entrypoint: fix indexes, seed agent, then start LibreChat
cd /app

echo "[DAX] Dropping Cosmos DB unique indexes on social provider fields..."
NODE_ENV=production node /app/patches/drop-unique-indexes.js 2>&1 || true

echo "[DAX] Seeding document generator agent..."
NODE_ENV=production node /app/patches/seed-docgen-agent.js 2>&1 || true

echo "[DAX] Starting LibreChat..."
exec env NODE_ENV=production node api/server/index.js "$@"
