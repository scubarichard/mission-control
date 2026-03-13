#!/bin/sh
# DAX custom entrypoint: drop problematic unique indexes, then start LibreChat
echo "[DAX] Dropping Cosmos DB unique indexes on social provider fields..."
cd /app
NODE_ENV=production node /app/patches/drop-unique-indexes.js 2>&1 || true
echo "[DAX] Starting LibreChat..."
exec env NODE_ENV=production node api/server/index.js "$@"
