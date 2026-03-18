# DAX Build Session 7 — Handoff Status

**Date:** 2026-03-18
**Session Focus:** RAG API installation, file upload pipeline, Schwab CSV ingestion

---

## 🎯 Session Goal
Enable DAX to read uploaded Schwab CSV files and auto-generate ICP reports for all clients without the advisor naming them manually.

---

## ✅ What Was Completed This Session

### 1. SSH Fixed on n8n VM
- SSH service was inactive — fixed via `az vm run-command invoke` → `systemctl start ssh && systemctl enable ssh`
- SSH is now enabled on boot

### 2. RAG API Installed on n8n VM
- Cloned to `/home/dkn8n/rag_api`
- Installed packages with `pip3 install ... --break-system-packages` (minimal set — no PyTorch/CUDA)
- Running via PM2 as `rag-api` (id: 4) on port 8000

### 3. RAG API `.env` Configuration
```
RAG_PORT=8000
EMBEDDINGS_PROVIDER=openai
OPENAI_API_KEY=635645200b2c4f90a1833de2bda6b753
OPENAI_API_BASE=https://oai-dax-dakona-pilot.openai.azure.com/
EMBEDDINGS_MODEL=text-embedding-ada-002
JWT_SECRET=dax-rag-secret-2026
VECTOR_DB_TYPE=atlas-mongo
ATLAS_MONGO_DB_URI=mongodb://cosmos-dax-dakona-pilot:uH4yWzAqgQXyy9JQghlPUp2MhbwZ1KoSbCm8oxxGoMB4Ve3lKJ34iNjYSdKPTvTqBLFUbTGqo2L4ACDbNY3Utg==@cosmos-dax-dakona-pilot.mongo.cosmos.azure.com:10255/librechat?ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000
MONGODB_DB_NAME=librechat
```
**Critical:** The correct env var is `ATLAS_MONGO_DB_URI` (not `MONGODB_URI`). This was the root cause of the RAG API connecting to `127.0.0.1:27018` (local default) instead of Cosmos DB.

### 4. NSG Rule Added
- Port 8000 open inbound to `10.0.0.0/16` (DAX VNet only) — rule name `Allow-RAG-8000`

### 5. DAX Container Updated
- `RAG_API_URL=http://172.16.0.4:8000` added to container env vars via Deploy-SSOConfig.ps1
- `RAG_PORT=8000` added
- `JWT_SECRET` added as plain-text (matching RAG API)
- LibreChat no longer logs "RAG API not reachable" warning on startup ✅

### 6. n8n Router Workflow Updated
- Added **"Fetch File from RAG"** node between Route Switch and ICP Field Extractor
- Node queries Cosmos DB via shell-runner for latest `file_id`, then calls RAG API `/query_multiple`
- Falls back gracefully if RAG unavailable (no break to general chat)
- Shell runner workflow ID: `DDYzrtekTv9PqA41`

### 7. librechat.yaml System Prompt Updated
- Added file upload instructions — DAX told it CAN read uploaded files
- "WHAT YOU MUST NEVER DO" includes "Say you cannot read or access uploaded files"

---

## ❌ What Is NOT Working Yet

### File Upload Pipeline — INCOMPLETE
**Root cause:** The RAG API was pointing at `127.0.0.1:27018` (local MongoDB) during all earlier upload attempts. The correct `ATLAS_MONGO_DB_URI` env var was only added at the end of this session.

**Status at end of session:**
- `curl http://localhost:8000/ids` returns `[]` (empty) — no files indexed yet
- All previous CSV uploads to DAX were stored in Cosmos `files` collection but NOT embedded in the RAG vector store
- File IDs confirmed in Cosmos: `f06c25bf`, `b8aae776`, `6bd19524`, `a1dee0de`, `83ad2178` (all `Schwab_DDF_Mockup_Q1_2026_v2.csv`)

**What needs to happen next:**
1. Confirm RAG API is now connecting to Cosmos (not local MongoDB) — run `curl http://localhost:8000/ids` after a fresh upload
2. Re-upload the Schwab CSV in a new DAX chat
3. Confirm the file gets indexed: `curl http://localhost:8000/ids` should return the file_id
4. Then test: "Generate ICP reports for all clients in the uploaded Schwab file"

---

## 🔧 Current n8n Router Workflow (3tniyxZREqfnAbfo)

**Node order:**
1. Webhook
2. Route Input (Code) — extracts userText, route, fileContent from messages
3. Route Switch (If) — `$json.route == "ICP"` → true/false
4. **Fetch File from RAG** (Code) ← NEW — queries Cosmos for file_id, calls RAG `/query_multiple`
5. ICP Field Extractor (HTTP → Azure OAI) — extracts 35 ICP fields, now receives `fileContent`
6. Build Document Payload (Code)
7. Need More Info? (If)
8. → Respond Ask More OR Generate Document → Format ICP Response → Respond ICP
9. Azure OpenAI Passthrough → Format General Response → Respond General

**Shell Runner Workflow** (`DDYzrtekTv9PqA41`):
- Webhook at `/webhook/shell-runner`
- Accepts `{ cmd: "..." }` POST
- Executes shell commands on n8n VM — used by Fetch File node to query Cosmos via Python/pymongo
- **Must be ACTIVE** for file fetching to work — check before testing

---

## 🖥️ Infrastructure State

| Resource | Value |
|---|---|
| Container App | `ca-dax-dakona-pilot` (rg-dax-dakona-pilot) |
| Active Revision | `ca-dax-dakona-pilot--0000062` |
| ACR Image | `acrdaxdakona.azurecr.io/librechat-dax:latest` |
| Azure OpenAI | `oai-dax-dakona-pilot`, deployment `gpt-4o` |
| API Key | `635645200b2c4f90a1833de2bda6b753` |
| Cosmos DB | `cosmos-dax-dakona-pilot` |
| n8n VM | `172.16.0.4` internal, `57.152.68.21` public, `Standard_D2s_v5` |
| RAG API | `http://172.16.0.4:8000` — PM2 id:4, running |
| n8n | PM2 id:1, running |
| MCP Server | PM2 id:2, running |

---

## 📋 Immediate Next Steps (Priority Order)

### Step 1 — Verify RAG API connects to Cosmos
```bash
pm2 restart rag-api --update-env
sleep 5
curl -s http://localhost:8000/ids
```
Expected: `[]` (empty but no error). If still shows connection refused → Cosmos URI not loading correctly.

### Step 2 — Re-upload Schwab CSV in DAX
- Open new DAX chat
- Upload `Schwab_DDF_Mockup_Q1_2026_v2.csv`
- Type: `file upload` (just to trigger processing)
- Wait for response

### Step 3 — Confirm file indexed
```bash
curl -s http://localhost:8000/ids
```
Should now return the file_id. If empty, LibreChat is not sending the file to RAG API — check LibreChat logs.

### Step 4 — Test full flow
In DAX (same chat or new chat):
> "Generate ICP reports for all clients in the uploaded Schwab file"

Expected: DAX returns 5 SharePoint links (one per client).

### Step 5 — If shell-runner not responding
Check it's active:
```javascript
// In n8n browser console
fetch('/api/v1/workflows/DDYzrtekTv9PqA41', { headers: { 'X-N8N-API-KEY': 'KEY' } })
  .then(r=>r.json()).then(d=>console.log('active:', d.active))
```
If false, activate it via API or n8n UI.

---

## 🐛 Known Issues / Gotchas

1. **`ATLAS_MONGO_DB_URI` not `MONGODB_URI`** — RAG API config.py uses `ATLAS_MONGO_DB_URI`. Setting `MONGODB_URI` does nothing.

2. **PM2 needs `--update-env`** — Standard `pm2 restart` does NOT pick up new env vars. Always use `pm2 restart rag-api --update-env` after `.env` changes.

3. **Shell runner must be active** — Workflow `DDYzrtekTv9PqA41` must be active for the Fetch File node to query Cosmos. It deactivates on its own sometimes.

4. **n8n code nodes block `require('mongodb')`** — Cannot use MongoDB npm module in n8n Code nodes. Work around via shell-runner HTTP call to Python/pymongo on VM.

5. **LibreChat custom endpoint limitation** — LibreChat does NOT inject file content into messages for custom endpoints. The full RAG pipeline (upload → embed → retrieve → inject) only works natively for OpenAI/Azure endpoints. Our workaround: n8n queries RAG API directly using file_id from Cosmos.

6. **Previous CSV uploads NOT indexed** — All uploads before `ATLAS_MONGO_DB_URI` was set went to 404. Must re-upload after the fix.

---

## 📁 Key Files

| File | Purpose |
|---|---|
| `librechat/librechat.yaml` | DAX endpoint config, system prompt, file upload config |
| `scripts/Deploy-SSOConfig.ps1` | Container deployment — includes RAG_API_URL env var |
| `/home/dkn8n/rag_api/.env` | RAG API config on n8n VM |
| n8n workflow `3tniyxZREqfnAbfo` | DAX router — main workflow |
| n8n workflow `DDYzrtekTv9PqA41` | Shell runner — helper for Cosmos queries |

---

## 🎯 Demo Readiness

**ICP report generation (manual):** ✅ Working
- "Generate Q1 review for Tony Stark, portfolio $3.2M, YTD 5.1%" → SharePoint link in ~15s

**General chat:** ✅ Working
- "What is an RIA?" → proper GPT-4o response

**File upload → auto ICP generation:** ❌ Not yet working
- Blocked on RAG API Cosmos connection (fixed at end of session, needs re-test)

**Git:** Clean, up to date with origin/master
**Last commit:** `22bc278` — feat: add RAG_API_URL to Deploy-SSOConfig.ps1

---

## 💡 If File Upload Still Doesn't Work After Re-testing

Consider alternative approach: **n8n reads the file directly from LibreChat's file storage** instead of via RAG embeddings. LibreChat stores uploaded files at `/app/uploads/` in the container. We could expose a small endpoint or use Azure Blob Storage (if configured) to retrieve the raw file content. This bypasses the RAG embedding pipeline entirely and gives n8n the raw CSV text directly — simpler and more reliable for structured data like CSVs where semantic search adds no value.
