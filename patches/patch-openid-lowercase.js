/**
 * DAX Patch: Normalize OpenID email to lowercase before user lookup
 *
 * Entra returns emails with mixed case (e.g. Brett@impact-cp.com).
 * LibreChat does a case-sensitive DB lookup, causing "user not found" warnings
 * on every login. This patch lowercases the email at the point of extraction
 * so lookups and new user records are always lowercase-normalized.
 */
'use strict';

const fs = require('fs');

const TARGET = '/app/api/strategies/openidStrategy.js';

if (!fs.existsSync(TARGET)) {
  console.log(`SKIP: ${TARGET} not found`);
  process.exit(0);
}

let content = fs.readFileSync(TARGET, 'utf8');

const before = 'const email = getOpenIdEmail(userinfo);';
const after  = 'const email = (getOpenIdEmail(userinfo) || \'\').toLowerCase();';

const count = (content.match(/const email = getOpenIdEmail\(userinfo\);/g) || []).length;
console.log(`[DAX] openidStrategy: found ${count} occurrence(s) of email extraction`);

if (count === 0) {
  console.log('[DAX] WARN: pattern not found — skipping patch');
  process.exit(0);
}

content = content.replace(before, after);
fs.writeFileSync(TARGET, content, 'utf8');

const verify = fs.readFileSync(TARGET, 'utf8');
const patched = (verify.match(/toLowerCase/g) || []).length;
console.log(`[DAX] Patch applied. toLowerCase refs in file: ${patched}`);
console.log('[DAX] openidStrategy email-lowercase patch complete.');
