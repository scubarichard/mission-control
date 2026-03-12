<#
.SYNOPSIS
    Generates an HTML compliance report of all LibreChat conversations.

.DESCRIPTION
    Connects to the client's Cosmos DB (MongoDB API) using the connection
    string stored in Key Vault, queries conversations and messages, and
    outputs an HTML report suitable for SEC/compliance review.

    Cosmos public network access must be open before running this script.
    Use Open-CosmosAccess.ps1 first, then Close-CosmosAccess.ps1 after.

    Requires: Python 3 with pymongo installed (pip install pymongo).

.PARAMETER ClientName
    Short client identifier.

.EXAMPLE
    ./Open-CosmosAccess.ps1 -ClientName dakona-pilot
    ./Get-ConversationReport.ps1 -ClientName dakona-pilot
    ./Close-CosmosAccess.ps1 -ClientName dakona-pilot
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $ClientName
)

$ErrorActionPreference = 'Stop'

$rgName  = "rg-dax-$ClientName"
$kvName  = ("kv-dax-$ClientName" -replace '-', '')
if ($kvName.Length -gt 24) { $kvName = $kvName.Substring(0, 24) }

$reportsDir = "$PSScriptRoot/../reports"
$date       = Get-Date -Format 'yyyy-MM-dd'
$reportFile = "$reportsDir/dax-compliance-${date}.html"

Write-Host "=== Conversation Compliance Report ===" -ForegroundColor Cyan
Write-Host "Client:    $ClientName"
Write-Host "Key Vault: $kvName"
Write-Host ""

# Ensure reports directory exists
if (-not (Test-Path $reportsDir)) { New-Item -ItemType Directory -Path $reportsDir | Out-Null }

# Get Cosmos connection string from Key Vault
Write-Host "Fetching connection string from Key Vault..." -ForegroundColor Yellow
$connStr = az keyvault secret show --vault-name "$kvName" --name "cosmos-connection-string" --query value -o tsv
if (-not $connStr) { Write-Error "Failed to retrieve cosmos-connection-string from $kvName"; return }

# Generate report via Python
Write-Host "Querying Cosmos DB and generating report..." -ForegroundColor Yellow

$pyScript = @'
import sys, json, html
from datetime import datetime, timezone
from pymongo import MongoClient

conn_str = sys.argv[1]
output_path = sys.argv[2]

client = MongoClient(conn_str, serverSelectionTimeoutMS=10000)
db = client["librechat"]

conversations = list(db.conversations.find().sort("createdAt", -1))
messages = list(db.messages.find().sort("createdAt", 1))

# Build user lookup: _id -> name/email
user_lookup = {}
for u in db.users.find():
    uid = str(u.get("_id", ""))
    name = u.get("name") or u.get("email") or u.get("username") or uid
    user_lookup[uid] = name

def resolve_user(uid):
    return user_lookup.get(str(uid), str(uid))

# Debug: print raw fields of one assistant message to diagnose text field
sample = db.messages.find_one({"sender": {"$ne": "user"}})
if sample:
    debug_fields = {k: type(v).__name__ for k, v in sample.items() if k != "_id"}
    print(f"DEBUG assistant message fields: {debug_fields}")
    for field in ("text", "content", "response", "message", "answer"):
        val = sample.get(field)
        if val:
            preview = str(val)[:200]
            print(f"DEBUG field '{field}': {preview}")

def get_message_text(m):
    """Extract message text, checking multiple possible field names."""
    # Try direct text field first
    text = m.get("text")
    if text:
        return str(text)
    # LibreChat may store assistant responses in content (string or list)
    content = m.get("content")
    if isinstance(content, str) and content:
        return content
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, dict):
                parts.append(part.get("text", part.get("value", str(part))))
            elif isinstance(part, str):
                parts.append(part)
        if parts:
            return "\n".join(parts)
    # Check other possible fields
    for field in ("response", "message", "answer"):
        val = m.get(field)
        if val:
            return str(val)
    return ""

# Index messages by conversationId
msg_by_convo = {}
for m in messages:
    cid = str(m.get("conversationId", ""))
    msg_by_convo.setdefault(cid, []).append(m)

# Compute summary stats
total_convos = len(conversations)
total_msgs = len(messages)
users = set()
dates = []
for c in conversations:
    u = resolve_user(c.get("user", "unknown"))
    users.add(u)
    created = c.get("createdAt")
    if created:
        dates.append(created)

date_range = "N/A"
if dates:
    mn = min(dates)
    mx = max(dates)
    fmt = lambda d: d.strftime("%Y-%m-%d %H:%M") if isinstance(d, datetime) else str(d)
    date_range = f"{fmt(mn)} &mdash; {fmt(mx)}"

def esc(text):
    return html.escape(str(text)) if text else ""

def fmt_time(dt):
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    return str(dt) if dt else ""

# Build HTML
lines = []
lines.append("""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>DAX Compliance Report</title>
<style>
  body { font-family: -apple-system, 'Segoe UI', sans-serif; margin: 2rem; color: #1a1a1a; }
  h1 { color: #0f3057; border-bottom: 2px solid #0f3057; padding-bottom: 0.5rem; }
  h2 { color: #0f3057; margin-top: 2rem; }
  h3 { color: #333; margin-top: 1.5rem; border-bottom: 1px solid #ddd; padding-bottom: 0.3rem; }
  .summary { background: #f4f6f9; padding: 1rem 1.5rem; border-radius: 6px; margin: 1rem 0; }
  .summary td { padding: 0.3rem 1rem 0.3rem 0; }
  .summary .label { font-weight: 600; color: #555; }
  table.convos { width: 100%; border-collapse: collapse; margin: 1rem 0; }
  table.convos th { background: #0f3057; color: #fff; padding: 0.5rem 0.75rem; text-align: left; }
  table.convos td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #e0e0e0; }
  table.convos tr:hover { background: #f8f9fa; }
  .thread { margin: 0.5rem 0 1.5rem 1rem; }
  .msg { padding: 0.5rem 0.75rem; margin: 0.3rem 0; border-left: 3px solid #ddd; }
  .msg.user { border-left-color: #2196F3; }
  .msg.assistant { border-left-color: #4CAF50; }
  .msg .meta { font-size: 0.8rem; color: #777; margin-bottom: 0.2rem; }
  .msg .sender { font-weight: 600; }
  .msg .text { white-space: pre-wrap; }
  .generated { margin-top: 2rem; font-size: 0.8rem; color: #999; border-top: 1px solid #eee; padding-top: 0.5rem; }
</style>
</head>
<body>
""")

lines.append(f"<h1>DAX Compliance Report &mdash; {esc(output_path.split('compliance-')[-1].replace('.html',''))}</h1>")

lines.append('<div class="summary"><table>')
lines.append(f'<tr><td class="label">Total conversations</td><td>{total_convos}</td></tr>')
lines.append(f'<tr><td class="label">Total messages</td><td>{total_msgs}</td></tr>')
lines.append(f'<tr><td class="label">Unique users</td><td>{len(users)}</td></tr>')
lines.append(f'<tr><td class="label">Date range</td><td>{date_range}</td></tr>')
lines.append('</table></div>')

# Conversation index table
lines.append('<h2>Conversations</h2>')
lines.append('<table class="convos">')
lines.append('<tr><th>#</th><th>User</th><th>Title</th><th>Date</th><th>Messages</th></tr>')

for i, c in enumerate(conversations, 1):
    cid = str(c.get("conversationId", c.get("_id", "")))
    user = esc(resolve_user(c.get("user", "unknown")))
    title = esc(c.get("title", "(untitled)"))
    created = fmt_time(c.get("createdAt"))
    msg_count = len(msg_by_convo.get(cid, []))
    anchor = f"convo-{i}"
    lines.append(f'<tr><td>{i}</td><td>{user}</td><td><a href="#{anchor}">{title}</a></td><td>{esc(created)}</td><td>{msg_count}</td></tr>')

lines.append('</table>')

# Full threads
lines.append('<h2>Message Threads</h2>')

for i, c in enumerate(conversations, 1):
    cid = str(c.get("conversationId", c.get("_id", "")))
    title = esc(c.get("title", "(untitled)"))
    user = esc(resolve_user(c.get("user", "unknown")))
    anchor = f"convo-{i}"

    lines.append(f'<h3 id="{anchor}">#{i} &mdash; {title}</h3>')
    lines.append(f'<div class="thread">')

    thread_msgs = msg_by_convo.get(cid, [])
    if not thread_msgs:
        lines.append('<p style="color:#999;">No messages found for this conversation.</p>')
    else:
        for m in thread_msgs:
            sender = m.get("sender", "unknown")
            css = "user" if sender == "user" else "assistant"
            ts = fmt_time(m.get("createdAt"))
            text = esc(get_message_text(m))
            lines.append(f'<div class="msg {css}">')
            lines.append(f'<div class="meta"><span class="sender">{esc(sender)}</span> &mdash; {esc(ts)}</div>')
            lines.append(f'<div class="text">{text}</div>')
            lines.append('</div>')

    lines.append('</div>')

lines.append(f'<div class="generated">Generated {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")} by Get-ConversationReport.ps1</div>')
lines.append('</body></html>')

with open(output_path, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print(f"Conversations: {total_convos}")
print(f"Messages:      {total_msgs}")
print(f"Users:         {len(users)}")

client.close()
'@

$tempPy = [System.IO.Path]::GetTempFileName() -replace '\.tmp$', '.py'
$pyScript | Out-File -FilePath $tempPy -Encoding utf8

try {
    python $tempPy $connStr $reportFile
    if ($LASTEXITCODE -ne 0) { throw "Python script failed" }
}
finally {
    Remove-Item -Path $tempPy -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Report saved to: $reportFile" -ForegroundColor Green
Write-Host "Remember to run Close-CosmosAccess.ps1 when done."
