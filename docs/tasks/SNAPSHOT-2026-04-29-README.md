# DAX Snapshot — 2026-04-29

## Status: SAVED on n8n VM

**Location:** `/repo/n8n/snapshots/2026-04-29/` on `n8n.dakona.net`  
**Count:** 50 workflows  
**Taken:** 2026-04-29 before TASK-20260429-001 Graph SDK Migration begins  

## To restore any workflow:

```bash
# SSH to n8n VM
ssh dkn8n@ssh-n8n.dakona.net

# Find the workflow file
ls /repo/n8n/snapshots/2026-04-29/

# Restore via n8n API (localhost)
curl -X PUT http://localhost:5678/api/v1/workflows/{WORKFLOW_ID} \
  -H "X-N8N-API-KEY: {API_KEY}" \
  -H "Content-Type: application/json" \
  -d @/repo/n8n/snapshots/2026-04-29/{WORKFLOW_FILE}.json
```

## Key workflow files in snapshot:
- `DAX-Router---AI-Agent.json` — 28 nodes, main router
- `DAX-Document-Generator.json` — quarterly review generation
- `DAX-Schwab-SharePoint-Processor.json` — Schwab report generation
- `DAX-Research-and-Write.json` — article generation
- `DAX-Market-Summary.json` — market news
- `DAX-Compliance-Flagging.json` — Reg BI checks

## Notes:
- Snapshot files are NOT in git (GitHub auth not available on n8n VM)
- Files are on the n8n VM local disk only
- If n8n VM is deleted, these snapshots are lost
- Forge: copy snapshots to vm-dax-dev and commit to git as first step
