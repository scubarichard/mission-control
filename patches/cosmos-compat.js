/**
 * Cosmos DB compatibility layer for LibreChat.
 *
 * Azure Cosmos DB for MongoDB (RU tier) does not support the $bitsAllSet
 * query operator, which LibreChat v0.8.0-rc3+ uses for agent permissions.
 *
 * This module monkey-patches the MongoDB driver's Collection methods to
 * rewrite { $bitsAllSet: mask } into { $in: [all values where (v & mask) === mask] }
 * before the query reaches Cosmos DB.
 *
 * Preloaded via: node -r /app/patches/cosmos-compat.js api/server/index.js
 */

let mongodb;
try {
  mongodb = require('mongodb');
} catch {
  console.log('[DAX] mongodb driver not found, skipping Cosmos DB compat patch');
  return;
}

const Collection = mongodb.Collection;
if (!Collection || !Collection.prototype) {
  console.log('[DAX] Collection.prototype not available, skipping compat patch');
  return;
}

/**
 * Recursively walk a query object and replace every
 * { $bitsAllSet: mask } with { $in: [matching values] }.
 */
function expandBitsAllSet(obj) {
  if (obj === null || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach(expandBitsAllSet);
    return;
  }
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (key === '$bitsAllSet' && typeof val === 'number') {
      const mask = val;
      const matches = [];
      // Permission bits are small (0-255 is more than enough)
      for (let i = mask; i <= 255; i++) {
        if ((i & mask) === mask) matches.push(i);
      }
      delete obj.$bitsAllSet;
      obj.$in = matches;
    } else if (key === '$bitsAnySet' && typeof val === 'number') {
      // Also handle $bitsAnySet if used
      const mask = val;
      const matches = [];
      for (let i = 1; i <= 255; i++) {
        if ((i & mask) !== 0) matches.push(i);
      }
      delete obj.$bitsAnySet;
      obj.$in = matches;
    } else if (typeof val === 'object' && val !== null) {
      expandBitsAllSet(val);
    }
  }
}

// Patch Collection methods that accept filter/query objects
const methodsToPatch = [
  'find', 'findOne', 'countDocuments', 'deleteMany', 'deleteOne',
  'updateOne', 'updateMany', 'replaceOne', 'findOneAndUpdate',
  'findOneAndReplace', 'findOneAndDelete',
];

for (const method of methodsToPatch) {
  const orig = Collection.prototype[method];
  if (typeof orig !== 'function') continue;
  Collection.prototype[method] = function (filter, ...args) {
    if (filter && typeof filter === 'object') {
      expandBitsAllSet(filter);
    }
    return orig.call(this, filter, ...args);
  };
}

// distinct(key, filter) — filter is the second argument
const origDistinct = Collection.prototype.distinct;
if (typeof origDistinct === 'function') {
  Collection.prototype.distinct = function (key, filter, ...args) {
    if (filter && typeof filter === 'object') {
      expandBitsAllSet(filter);
    }
    return origDistinct.call(this, key, filter, ...args);
  };
}

console.log('[DAX] Cosmos DB compatibility loaded: $bitsAllSet/$bitsAnySet -> $in rewriter active');
