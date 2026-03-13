/**
 * Drop unique indexes on social provider ID fields from the users collection.
 *
 * Cosmos DB MongoDB API treats null as a unique value, so unique+sparse indexes
 * on googleId, facebookId, etc. block all users after the first from logging in
 * (E11000 duplicate key error).
 *
 * This script runs at container startup (before LibreChat) and drops the
 * problematic indexes. Mongoose will NOT recreate them because we patch the
 * schema via the companion sed command in the Dockerfile.
 *
 * Usage: node drop-unique-indexes.js
 * Requires MONGO_URI environment variable.
 */

const FIELDS_TO_FIX = [
  'googleId',
  'facebookId',
  'openidId',
  'samlId',
  'ldapId',
  'githubId',
  'discordId',
  'appleId',
];

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('[drop-unique-indexes] MONGO_URI not set, skipping');
    process.exit(0);
  }

  let MongoClient;
  try {
    ({ MongoClient } = require('mongodb'));
  } catch {
    // Fall back to mongoose's built-in connection
    const mongoose = require('mongoose');
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    await dropIndexes(db);
    await mongoose.disconnect();
    return;
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('librechat');
    await dropIndexes(db);
  } finally {
    await client.close();
  }
}

async function dropIndexes(db) {
  const collection = db.collection('users');
  let indexes;
  try {
    indexes = await collection.indexes();
  } catch (err) {
    console.error('[drop-unique-indexes] Failed to list indexes:', err.message);
    return;
  }

  let dropped = 0;
  for (const idx of indexes) {
    if (idx.name === '_id_') continue;
    const keys = Object.keys(idx.key || {});
    if (keys.length === 1 && FIELDS_TO_FIX.includes(keys[0]) && idx.unique) {
      try {
        await collection.dropIndex(idx.name);
        console.log(`[drop-unique-indexes] Dropped index: ${idx.name}`);
        dropped++;
      } catch (err) {
        console.error(`[drop-unique-indexes] Failed to drop ${idx.name}:`, err.message);
      }
    }
  }

  if (dropped === 0) {
    console.log('[drop-unique-indexes] No problematic indexes found (already clean)');
  } else {
    console.log(`[drop-unique-indexes] Dropped ${dropped} unique index(es)`);
  }
}

main().catch((err) => {
  console.error('[drop-unique-indexes] Error:', err.message);
  process.exit(0); // Don't block startup on failure
});
