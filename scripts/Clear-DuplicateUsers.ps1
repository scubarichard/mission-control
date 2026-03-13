<#
.SYNOPSIS
    Deletes duplicate/partial user records from Cosmos DB to fix E11000 login errors.

.DESCRIPTION
    Opens Cosmos DB network access, connects via pymongo, deletes all user
    records matching the specified emails from the librechat.users collection,
    then closes Cosmos access.

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

$kvName = ("kv-dax-$ClientName" -replace '-', '')
if ($kvName.Length -gt 24) { $kvName = $kvName.Substring(0, 24) }

Write-Host "=== Clear Duplicate Users ===" -ForegroundColor Cyan
Write-Host "Client:    $ClientName"
Write-Host "Key Vault: $kvName"
Write-Host "Emails:    $($Emails -join ', ')"
Write-Host ""

# 1. Open Cosmos access
Write-Host "Opening Cosmos DB access..." -ForegroundColor Yellow
& "$PSScriptRoot/Open-CosmosAccess.ps1" -ClientName $ClientName
Write-Host ""

# 2. Get connection string from Key Vault
Write-Host "Fetching connection string from Key Vault..." -ForegroundColor Yellow
$connStr = az keyvault secret show --vault-name "$kvName" --name "cosmos-connection-string" --query value -o tsv
if (-not $connStr) {
    Write-Error "Failed to retrieve cosmos-connection-string from $kvName"
    & "$PSScriptRoot/Close-CosmosAccess.ps1" -ClientName $ClientName
    return
}

# 3. Delete user records via Python (write to temp file to avoid quoting issues)
Write-Host "Deleting user records..." -ForegroundColor Yellow

$pyFile = [System.IO.Path]::GetTempFileName() -replace '\.tmp$', '.py'

$pyScript = @'
import sys
from pymongo import MongoClient

conn_str = sys.argv[1]
emails = sys.argv[2:]

client = MongoClient(conn_str, tls=True, tlsAllowInvalidCertificates=True)
db = client['librechat']
users = db['users']

for email in emails:
    email_lower = email.lower()
    result = users.delete_many({'$or': [
        {'email': email_lower},
        {'email': email},
        {'username': email_lower},
        {'username': email}
    ]})
    status = f"DELETED {result.deleted_count}" if result.deleted_count > 0 else "NOT FOUND"
    print(f"  {email}: {status}")

client.close()
'@

[System.IO.File]::WriteAllText($pyFile, $pyScript)
python $pyFile "$connStr" $Emails
Remove-Item $pyFile -Force

if ($LASTEXITCODE -ne 0) {
    Write-Host "Python script failed." -ForegroundColor Red
    & "$PSScriptRoot/Close-CosmosAccess.ps1" -ClientName $ClientName
    return
}

Write-Host ""

# 4. Close Cosmos access
Write-Host "Closing Cosmos DB access..." -ForegroundColor Yellow
& "$PSScriptRoot/Close-CosmosAccess.ps1" -ClientName $ClientName

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
Write-Host "Affected users can now log in fresh via SSO."
