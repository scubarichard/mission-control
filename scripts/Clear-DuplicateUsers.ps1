<#
.SYNOPSIS
    Deletes duplicate/partial user records from Cosmos DB to fix E11000 login errors.

.DESCRIPTION
    Uses Azure CLI Cosmos DB MongoDB commands (control plane) to find and delete
    user records matching the specified emails from the librechat.users collection.

    No firewall changes needed — uses Azure control plane, not data plane.

    After running, affected users can log in fresh via SSO and a new record
    will be created automatically.

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
$dbName      = "librechat"
$collName    = "users"

Write-Host "=== Clear Duplicate Users ===" -ForegroundColor Cyan
Write-Host "Client:    $ClientName"
Write-Host "Account:   $accountName"
Write-Host "Emails:    $($Emails -join ', ')"
Write-Host ""

foreach ($email in $Emails) {
    $emailLower = $email.ToLower()
    Write-Host "Processing: $email" -ForegroundColor Yellow

    # Query for matching documents by email or username (case-insensitive)
    $filter = "{`"`$or`": [{`"email`": `"$emailLower`"}, {`"email`": `"$email`"}, {`"username`": `"$emailLower`"}, {`"username`": `"$email`"}]}"

    $docs = az cosmosdb mongodb collection list-documents `
        --account-name $accountName `
        --resource-group $rgName `
        --database-name $dbName `
        --collection-name $collName `
        --filter "$filter" `
        -o json 2>&1

    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR querying: $docs" -ForegroundColor Red
        continue
    }

    $parsed = $docs | ConvertFrom-Json
    if (-not $parsed -or $parsed.Count -eq 0) {
        Write-Host "  NOT FOUND" -ForegroundColor Gray
        continue
    }

    $deleteCount = 0
    foreach ($doc in $parsed) {
        $docId = $doc._id
        # Handle ObjectId format — extract $oid if present
        if ($docId -is [PSCustomObject] -and $docId.'$oid') {
            $docId = $docId.'$oid'
        }

        Write-Host "  Deleting document _id=$docId ..." -ForegroundColor White

        az cosmosdb mongodb collection delete-document `
            --account-name $accountName `
            --resource-group $rgName `
            --database-name $dbName `
            --collection-name $collName `
            --document-id "$docId" `
            -o none 2>&1

        if ($LASTEXITCODE -eq 0) {
            $deleteCount++
        } else {
            Write-Host "  WARNING: Failed to delete _id=$docId" -ForegroundColor Red
        }
    }

    Write-Host "  DELETED $deleteCount of $($parsed.Count) matching records" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
Write-Host "Affected users can now log in fresh via SSO."
