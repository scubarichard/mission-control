# DAX v0.5.1+ Root Cause Analysis: "Cannot read properties of undefined (reading 'role')"

## Date: 2026-03-26
## Status: Root cause identified and resolved. Email isolation (v0.5.2) not yet re-implemented.

---

## Summary

After upgrading n8n from 2.9.4 to 2.13.4 and modifying DAX workflows to support per-advisor email isolation, every message to DAX returned:

> "Cannot read properties of undefined (reading 'role')"

The error appeared to come from LibreChat's `api/server/controllers/agents/client.js #sendCompletion`, which led to multiple failed attempts to fix LibreChat's routing, the Dockerfile, the base image, the seeded agent, and the `user` field in `dropParams`. **None of those were the actual problem.**

---

## Root Cause

**n8n 2.13.4 runs Code nodes in a sandboxed JavaScript VM (task runner) where `process` is not a global.** All DAX Router Code nodes used `process.env.VARIABLE_NAME` to read environment variables. This worked in n8n 2.9.4 (which ran Code nodes in the main Node.js process) but throws `ReferenceError: process is not defined` in 2.13.4's sandboxed runner.

### The chain of failure:
1. User sends message to DAX via LibreChat
2. LibreChat POSTs to n8n webhook (`https://n8n.dakona.net/webhook/dax/chat/completions`)
3. n8n DAX Router workflow fires → Extract Message Code node runs
4. **Extract Message crashes at line 59:** `process.env.ADVISOR_EMAIL` → `ReferenceError: process is not defined`
5. n8n returns an error response to LibreChat
6. LibreChat's agents/client.js tries to parse the error response as a valid completion
7. The response has no `messages` array → iterating messages hits `undefined` → `Cannot read properties of undefined (reading 'role')`

### Why it was misdiagnosed:
- The visible error was in LibreChat's code, not n8n's
- LibreChat's error message (`reading 'role'`) gave no hint that the upstream n8n call failed
- The error appeared to correlate with LibreChat config changes (removing `"user"` from `dropParams`) because those changes were made in the same session as the n8n upgrade
- Multiple red herrings: the seeded "DAX Assistant" agent, the `user` field, the `stream: false` param, the base image digest

### The fix:
Replace `process.env.X` with `$env.X` in all n8n Code nodes. In n8n 2.13.4+, the `$env` object is the sanctioned way to access environment variables from within the Code node sandbox.

**12 nodes across 3 workflows were affected:**
- DAX Router (3tniyxZREqfnAbfo): Extract Message, Client Lookup Tool, List Clients Tool, Meeting Prep Tool, Email Tool, Calendar Tool, Send Email Tool, Manage Calendar Tool, Compliance Flag Check, Market Summary Tool
- DAX Market Summary (7oPNzVYnYKgxqeYP): Format Response
- DAX Schwab SharePoint (8y1fZmL1anhRDY0K): Log Audit

---

## Current State (v0.5.0-clean + n8n fixes)

### What's working:
- LibreChat running original v0.5.0-clean image from ACR (no Dockerfile changes)
- n8n 2.13.4 with all `process.env` → `$env` fixes applied
- DAX responds to messages correctly
- Dynamic timezone from Exchange mailbox works
- DAX Agent system prompt resolves `{{ }}` expressions (prefixed with `=`)
- All tool nodes use dynamic `advisorEmail` variable (reads from `$input` pipeline)

### What's NOT working yet:
- **Per-advisor email isolation**: The `advisorEmail` in tool nodes falls back to `$env.ADVISOR_EMAIL` (env var) because LibreChat is not passing the logged-in user's email to n8n
- The v0.5.0-clean image has `"user"` in `dropParams`, so LibreChat strips the user ID from the request body

---

## Path to v0.5.2: Per-Advisor Email Isolation

### Goal:
When Advisor A asks "check my email", DAX reads Advisor A's inbox — not a hardcoded mailbox.

### Architecture:
```
LibreChat (Entra SSO) → knows req.user.email
    ↓ POST to n8n webhook
n8n Extract Message → needs to know advisor's email
    ↓ passes advisorEmail to tool nodes
Tool nodes → Graph API calls use dynamic email in URL path
```

### The challenge:
LibreChat's custom endpoint sends an OpenAI-compatible request body to n8n. The body has `messages`, `model`, and optionally `user`. But:
- Removing `"user"` from `dropParams` did NOT cause the role crash (that was the n8n `process.env` issue)
- However, the `user` field contains the LibreChat user ID (not the email)
- The user ID requires a Cosmos DB lookup to get the email

### Approach A — Remove "user" from dropParams (NOW SAFE):
Since the root cause was `process.env` in n8n (not the `user` field), we can now safely:
1. Remove `"user"` from `dropParams` in librechat.yaml
2. The user ID flows to n8n in `body.user`
3. n8n Extract Message looks up the email from Cosmos DB using the user ID
4. **IMPORTANT:** Use `$env.COSMOS_LIBRECHAT_URI` (not `process.env`) for the connection string
5. **IMPORTANT:** Use `require('mongodb')` which is available in n8n's Code node sandbox

### Approach B — Middleware injection (backup):
A patch file `inject-advisor-email.js` was created at `patches/inject-advisor-email.js` that:
1. Adds Express middleware to LibreChat
2. Reads `req.user.email` from the Entra SSO session
3. Injects it into `req.body.advisorEmail`
4. n8n reads `body.advisorEmail` directly — no Cosmos lookup needed

This approach requires a Dockerfile change and LibreChat rebuild. Use this if Approach A doesn't work.

### Implementation steps:
1. **Test Approach A first** — just remove `"user"` from dropParams, rebuild LibreChat, deploy. If DAX still works (no role crash), the `user` field was never the problem.
2. **Update Extract Message** to read `body.user` and look up email from Cosmos DB using `$env.COSMOS_LIBRECHAT_URI` (already in n8n env vars)
3. **Verify** all 5 email/calendar tool nodes use `advisorEmail` from the Extract Message pipeline output (already done)
4. **Test** with a second user to confirm isolation

### n8n environment variables available (set in PM2 ecosystem.config.js):
```
GRAPH_TENANT_ID=d2a3c346-00f3-47dd-a53e-caa3fca74714
GRAPH_CLIENT_ID=218064ac-bee2-4246-9709-ae7518ae71cb
GRAPH_CLIENT_SECRET=6LR8Q~ZCn5FTBlg894LtCGlXZ9GV3NAhS4BY9bla
ADVISOR_TIMEZONE=America/Chicago
ADVISOR_EMAIL=vince@dakona.com  (fallback only)
COSMOS_LIBRECHAT_URI=mongodb://cosmos-dax-dakona-pilot:uH4yWzAqgQXyy9JQghlPUp2MhbwZ1KoSbCm8oxxGoMB4Ve3lKJ34iNjYSdKPTvTqBLFUbTGqo2L4ACDbNY3Utg==@cosmos-dax-dakona-pilot.mongo.cosmos.azure.com:10255/librechat?ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000
```

**Access these with `$env.VARIABLE_NAME` in n8n Code nodes — NEVER `process.env`.**

### Critical constraints:
- n8n 2.13.4 Code nodes: NO `process.env`, use `$env` instead
- n8n 2.13.4 Code nodes: `require()` works for packages in n8n's node_modules (mongodb is available)
- n8n 2.13.4 Code nodes: `fetch()` is available for HTTP calls
- LibreChat v0.8.4: ALL chat requests route through agents/client.js (there is no separate custom endpoint controller)
- LibreChat v0.8.4: `dropParams` controls what gets sent to the external API, not LibreChat's internal routing
- The seeded "DAX Assistant" agent (seed-docgen-agent.js) does NOT cause the routing issue — agents/client.js handles all endpoints in v0.8.4

### Key files:
- `librechat/librechat.yaml` — custom endpoint config, dropParams
- `patches/entrypoint.sh` — startup sequence
- `patches/inject-advisor-email.js` — middleware approach (Approach B)
- `Dockerfile` — build pipeline
- n8n workflow `3tniyxZREqfnAbfo` — DAX Router with all tool nodes
- PM2 config on n8n VM (`52.150.28.158`, user `dkn8n`): `~/ecosystem.config.js`

### Git state:
- `v0.5.0-clean` tag/image: working, currently deployed
- HEAD (master): has uncommitted changes from debugging session
- Uncommitted files include: Dockerfile changes, entrypoint changes, inject-advisor-email.js, librechat.yaml changes
- Recommend: `git checkout .` to reset to clean state, then apply changes incrementally

---

## Lessons Learned

1. **When upgrading n8n, check Code node sandbox compatibility.** The move from 2.9.x to 2.13.x changed `process.env` → `$env`. This is documented but easy to miss.
2. **Check n8n execution logs FIRST when LibreChat returns errors.** The visible error in LibreChat was a red herring — the actual failure was in n8n.
3. **n8n expressions in AI Agent system prompts require `=` prefix.** Without it, `{{ }}` is literal text.
4. **Docker image tags are mutable.** Rebuilding with `FROM image:v0.8.4` may pull a different binary than the original build. Pin digests for reproducibility.
5. **Test one change at a time.** Multiple simultaneous changes (n8n upgrade + workflow edits + LibreChat config) made the root cause impossible to isolate quickly.
