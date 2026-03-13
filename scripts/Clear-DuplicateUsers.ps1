<#
.SYNOPSIS
    Deletes duplicate/partial user records from Cosmos DB to fix E11000 login errors.

.DESCRIPTION
    Opens Cosmos DB public access temporarily, uses pymongo via the connection
    string from Key Vault to delete matching user records, then closes access.

    Uses the same proven connection pattern as Get-ConversationReport.ps1.

    Unlike previous versions, this script opens access to ALL IPs (not just
    the caller's IP) to avoid NAT/proxy/VPN firewall mismatches, then locks
    it back down immediately after.

    After running, affected users can log in fresh via SSO and a new record
    will be created automatically.

    Requires: Python 3 with pymongo installed (pip install pymongo).

.PARAMETER ClientName
    Short client identifier.

.PARAMETER Emails
    Array of email addresses to clear.

.EXAMPLE
    ./Clear-DuplicateUsers.ps1 -ClientName dakona-pilot `
        -Emails "vmabbun@dakona.com","pdmabbun@dakona.com","akatigbak@dakona.com","mceril@dakona.com"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string]   $ClientName,
    [Parameter(Mandatory)] [string[]] $Emails
)

$ErrorActionPreference = 'Stop'

$rgName      = "rg-dax-$ClientName"
$accountName = "cosmos-dax-$ClientName"
$kvName      = ("kv-dax-$ClientName" -replace '-', '')
if ($kvName.Length -gt 24) { $kvName = $kvName.Substring(0, 24) }

Write-Host "=== Clear Duplicate Users ===" -ForegroundColor Cyan
Write-Host "Client:    $ClientName"
Write-Host "Account:   $accountName"
Write-Host "Key Vault: $kvName"
Write-Host "Emails:    $($Emails -join ', ')"
Write-Host ""

# 1. Open Cosmos access to ALL IPs (avoids NAT/proxy mismatch)
Write-Host "Opening Cosmos DB public access..." -ForegroundColor Yellow

$subId   = (az account show --query id -o tsv)
$token   = (az account get-access-token --query accessToken -o tsv)
$headers = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }
$uri     = "https://management.azure.com/subscriptions/$subId/resourceGroups/$rgName/providers/Microsoft.DocumentDB/databaseAccounts/${accountName}?api-version=2023-04-15"
$body    = '{"properties":{"publicNetworkAccess":"Enabled","ipRules":[]}}'

Invoke-RestMethod -Method PATCH -Uri $uri -Headers $headers -Body $body | Out-Null
Write-Host "  Public access enabled (all IPs)" -ForegroundColor Green

# Wait for firewall rule to propagate
Write-Host "Waiting 90 seconds for propagation..." -ForegroundColor Yellow
Start-Sleep -Seconds 90

# 2. Get connection string from Key Vault
Write-Host "Fetching connection string from Key Vault..." -ForegroundColor Yellow
$connStr = az keyvault secret show --vault-name "$kvName" --name "cosmos-connection-string" --query value -o tsv
if (-not $connStr) {
    Write-Error "Failed to retrieve cosmos-connection-string from $kvName"
    return
}

# 3. Delete user records via Python
Write-Host "Deleting user records..." -ForegroundColor Yellow

$pyFile = [System.IO.Path]::GetTempFileName() -replace '\.tmp$', '.py'

$pyScript = @'
import sys
from pymongo import MongoClient

conn_str = sys.argv[1]
emails = sys.argv[2:]

client = MongoClient(conn_str, serverSelectionTimeoutMS=30000)
db = client["librechat"]
users = db["users"]

for email in emails:
    email_lower = email.lower()
    result = users.delete_many({"$or": [
        {"email": email_lower},
        {"email": email},
        {"username": email_lower},
        {"username": email}
    ]})
    status = f"DELETED {result.deleted_count}" if result.deleted_count > 0 else "NOT FOUND"
    print(f"  {email}: {status}")

client.close()
'@

$pyScript | Out-File -FilePath $pyFile -Encoding utf8

try {
    python $pyFile "$connStr" $Emails
    if ($LASTEXITCODE -ne 0) { throw "Python script failed" }
}
catch {
    Write-Host "Python script failed: $_" -ForegroundColor Red
}
finally {
    Remove-Item -Path $pyFile -Force -ErrorAction SilentlyContinue
}

Write-Host ""

# 4. Close Cosmos access — disable public network access entirely
#    Retry with backoff because the open PATCH may still be propagating
Write-Host "Closing Cosmos DB public access..." -ForegroundColor Yellow

$body = '{"properties":{"publicNetworkAccess":"Disabled","ipRules":[]}}'
$closed = $false

for ($attempt = 1; $attempt -le 6; $attempt++) {
    Start-Sleep -Seconds (15 * $attempt)
    try {
        $token   = (az account get-access-token --query accessToken -o tsv)
        $headers = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }
        Invoke-RestMethod -Method PATCH -Uri $uri -Headers $headers -Body $body | Out-Null
        $closed = $true
        break
    }
    catch {
        Write-Host "  Attempt $attempt failed (operation in progress), retrying..." -ForegroundColor Gray
    }
}

if ($closed) {
    Write-Host "  Public access disabled" -ForegroundColor Green
} else {
    Write-Host "  WARNING: Could not disable public access. Run manually:" -ForegroundColor Red
    Write-Host "  az cosmosdb update -n $accountName -g $rgName --public-network-access DISABLED"
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
Write-Host "Affected users can now log in fresh via SSO."
