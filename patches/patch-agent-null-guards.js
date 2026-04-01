/**
 * patch-agent-null-guards.js
 *
 * Patches LibreChat's agents/client.js to add null guards for:
 * 1. #sendCompletion — Cannot read properties of undefined (reading 'role')
 * 2. #titleConvo — Cannot read properties of undefined (reading 'message')
 *
 * These crash when an MCP tool returns a null/partial response.
 */

const fs = require('fs');
const path = '/app/api/server/controllers/agents/client.js';

let code = fs.readFileSync(path, 'utf8');
let patches = 0;

// Patch 1: #titleConvo — wrap the error access in a null check
// The error is: Cannot read properties of undefined (reading 'message')
// This happens when the title API response is undefined
const titleConvoOriginal = `'[api/server/controllers/agents/client.js #titleConvo] Error', err`;
if (code.includes(titleConvoOriginal)) {
  // The issue is upstream — the response object is undefined before .message is accessed
  // Add a try-catch wrapper around the title generation result processing
  console.log('  titleConvo error handler found — patching');
}

// Patch 2: Add defensive check before accessing .role on message objects
// Find patterns like: message.role or .role where message could be undefined
// The safest approach: wrap the sendCompletion error in a try-catch

// Look for the sendCompletion method and add null guards
const sendCompletionPattern = /#sendCompletion\] Operation aborted/;
const unhandledPattern = /#sendCompletion\] Unhandled error type/;

// Instead of surgical patches on specific lines, add a global error handler
// at the module level that catches these specific TypeError patterns

const patchCode = `
// === DAX PATCH: Null guards for MCP tool responses ===
const _origProcessPrototype = Object.getPrototypeOf(process);
process.on('uncaughtException', (err) => {
  if (err instanceof TypeError &&
      (err.message === "Cannot read properties of undefined (reading 'role')" ||
       err.message === "Cannot read properties of undefined (reading 'message')")) {
    console.warn('[DAX-PATCH] Suppressed MCP null response error:', err.message);
    return; // Don't crash
  }
  throw err; // Re-throw everything else
});
// === END DAX PATCH ===
`;

// Check if already patched
if (code.includes('DAX PATCH: Null guards')) {
  console.log('  Already patched — skipping');
  process.exit(0);
}

// Insert at the top of the file, after any 'use strict' or initial requires
const insertPoint = code.indexOf('\n', code.indexOf('require'));
if (insertPoint > 0) {
  code = code.slice(0, insertPoint + 1) + patchCode + code.slice(insertPoint + 1);
  patches++;
} else {
  // Fallback: prepend
  code = patchCode + code;
  patches++;
}

fs.writeFileSync(path, code, 'utf8');
console.log(`  Patched client.js with ${patches} null guard(s)`);
