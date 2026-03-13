/**
 * Check if the users collection has problematic unique indexes on social
 * provider ID fields. If so, drop the entire collection so LibreChat
 * recreates it using the patched schema (without unique constraints).
 *
 * Cosmos DB does not allow modifying unique indexes on non-empty collections,
 * so dropping the collection is the only way to fix existing deployments.
 *
 * Usage: node drop-unique-indexes.js
 * Requires MONGO_URI environment variable.
 */

const PROBLEM_FIELDS = [
  'googleId', 'facebookId', 'openidId', 'samlId',
  'ldapId', 'githubId', 'discordId', 'appleId',
];

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.log('[DAX] MONGO_URI not set, skipping index check');
    return;
  }

  const mongoose = require('mongoose');
  try {
    await mongoose.connect(uri);
  } catch (err) {
    console.error('[DAX] Cannot connect to DB, skipping index check:', err.message);
    return;
  }

  const db = mongoose.connection.db;
  const collections = await db.listCollections({ name: 'users' }).toArray();
  if (collections.length === 0) {
    console.log('[DAX] No users collection yet - will be created with patched schema');
    await mongoose.disconnect();
    return;
  }

  const usersCol = db.collection('users');
  let indexes;
  try {
    indexes = await usersCol.indexes();
  } catch (err) {
    console.error('[DAX] Cannot list indexes:', err.message);
    await mongoose.disconnect();
    return;
  }

  // Check if any problematic unique indexes exist
  const badIndexes = indexes.filter(idx => {
    const keys = Object.keys(idx.key || {});
    return keys.length === 1 && PROBLEM_FIELDS.includes(keys[0]) && idx.unique;
  });

  if (badIndexes.length === 0) {
    console.log('[DAX] No problematic unique indexes found - schema is clean');
    await mongoose.disconnect();
    return;
  }

  console.log(`[DAX] Found ${badIndexes.length} problematic unique index(es):`);
  badIndexes.forEach(idx => console.log(`  - ${idx.name}`));
  console.log('[DAX] Dropping users collection so it will be recreated with patched schema...');

  try {
    await usersCol.drop();
    console.log('[DAX] Users collection dropped - will be recreated on first login');
  } catch (err) {
    console.error('[DAX] Failed to drop users collection:', err.message);
    console.error('[DAX] Users may still get E11000 errors until collection is manually dropped');
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('[DAX] Startup check error:', err.message);
});
