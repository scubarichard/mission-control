<#
.SYNOPSIS
    Deletes duplicate/partial user records from Cosmos DB to fix E11000 login errors.

.DESCRIPTION
    Uses the Cosmos DB SQL REST API directly from PowerShell with HMAC-SHA256
    master key authentication. No Python, no pymongo, no external dependencies.

    Temporarily opens Cosmos DB public access (required for data plane), runs
    the query and deletes, then closes access with retry.

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
$cosmosHost  = "$accountName.documents.azure.com"
$dbId        = "librechat"
$collId      = "users"

Write-Host "=== Clear Duplicate Users ===" -ForegroundColor Cyan
Write-Host "Client:    $ClientName"
Write-Host "Account:   $accountName"
Write-Host "Emails:    $($Emails -join ', ')"
Write-Host ""

# ---------- Helper: Generate Cosmos DB HMAC-SHA256 auth token ----------
function Get-CosmosAuthToken {
    param(
        [string] $Verb,
        [string] $ResourceType,
        [string] $ResourceLink,
        [string] $Date,
        [string] $MasterKey
    )
    $keyBytes = [System.Convert]::FromBase64String($MasterKey)
    $hmac = New-Object System.Security.Cryptography.HMACSHA256
    $hmac.Key = $keyBytes

    $payload = "$($Verb.ToLower())`n$($ResourceType.ToLower())`n$ResourceLink`n$($Date.ToLower())`n`n"
    $payloadBytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
    $signature = [System.Convert]::ToBase64String($hmac.ComputeHash($payloadBytes))

    return [System.Web.HttpUtility]::UrlEncode("type=master&ver=1.0&sig=$signature")
}

# ---------- Helper: Build Cosmos request headers ----------
function Get-CosmosHeaders {
    param(
        [string] $Verb,
        [string] $ResourceType,
        [string] $ResourceLink,
        [string] $MasterKey,
        [hashtable] $Extra = @{}
    )
    $date = [DateTime]::UtcNow.ToString("R")
    $auth = Get-CosmosAuthToken -Verb $Verb -ResourceType $ResourceType `
        -ResourceLink $ResourceLink -Date $date -MasterKey $MasterKey

    $headers = @{
        "Authorization"           = $auth
        "x-ms-date"               = $date
        "x-ms-version"            = "2018-12-31"
        "x-ms-documentdb-isquery" = "True"
    }
    foreach ($k in $Extra.Keys) { $headers[$k] = $Extra[$k] }
    return $headers
}

# ============================================================================
# 1. Open Cosmos public access temporarily
# ============================================================================
Write-Host "Opening Cosmos DB public access..." -ForegroundColor Yellow

$subId    = (az account show --query id -o tsv)
$armToken = (az account get-access-token --query accessToken -o tsv)
$armHeaders = @{ "Authorization" = "Bearer $armToken"; "Content-Type" = "application/json" }
$armUri   = "https://management.azure.com/subscriptions/$subId/resourceGroups/$rgName/providers/Microsoft.DocumentDB/databaseAccounts/${accountName}?api-version=2023-04-15"

Invoke-RestMethod -Method PATCH -Uri $armUri -Headers $armHeaders `
    -Body '{"properties":{"publicNetworkAccess":"Enabled","ipRules":[]}}' | Out-Null
Write-Host "  Public access enabled" -ForegroundColor Green

Write-Host "Waiting 90 seconds for propagation..." -ForegroundColor Yellow
Start-Sleep -Seconds 90

# ============================================================================
# 2. Get Cosmos master key (management plane — no firewall needed)
# ============================================================================
Write-Host "Fetching master key..." -ForegroundColor Yellow
$masterKey = az cosmosdb keys list -n $accountName -g $rgName --type keys --query primaryMasterKey -o tsv
if (-not $masterKey) {
    Write-Error "Failed to retrieve master key for $accountName"
    return
}
Write-Host "  Key retrieved" -ForegroundColor Green

# ============================================================================
# 3. Query and delete user documents via Cosmos SQL REST API
# ============================================================================
Write-Host "`nProcessing emails..." -ForegroundColor Yellow

$baseUri      = "https://$cosmosHost"
$collLink     = "dbs/$dbId/colls/$collId"
$docsLink     = "$collLink/docs"

foreach ($email in $Emails) {
    $emailLower = $email.ToLower()
    Write-Host "`n  $email" -ForegroundColor White

    # Query for matching documents
    $queryBody = @{
        query = "SELECT * FROM c WHERE c.email = @email1 OR c.email = @email2 OR c.username = @email1 OR c.username = @email2"
        parameters = @(
            @{ name = "@email1"; value = $emailLower }
            @{ name = "@email2"; value = $email }
        )
    } | ConvertTo-Json -Depth 5

    $qHeaders = Get-CosmosHeaders -Verb "POST" -ResourceType "docs" `
        -ResourceLink $collLink -MasterKey $masterKey `
        -Extra @{
            "Content-Type"                        = "application/query+json"
            "x-ms-documentdb-query-enablecrosspartition" = "True"
        }

    try {
        $result = Invoke-RestMethod -Method POST -Uri "$baseUri/$docsLink" `
            -Headers $qHeaders -Body $queryBody
    }
    catch {
        $status = $_.Exception.Response.StatusCode.value__
        $detail = $_.ErrorDetails.Message
        Write-Host "    QUERY FAILED (HTTP $status): $detail" -ForegroundColor Red
        continue
    }

    $docs = $result.Documents
    if (-not $docs -or $docs.Count -eq 0) {
        Write-Host "    NOT FOUND" -ForegroundColor Gray
        continue
    }

    Write-Host "    Found $($docs.Count) matching record(s)" -ForegroundColor Yellow

    # Delete each matching document
    $deleteCount = 0
    foreach ($doc in $docs) {
        $docId   = $doc.id
        $docRid  = $doc._rid
        $docLink = "$collLink/docs/$docId"

        $dHeaders = Get-CosmosHeaders -Verb "DELETE" -ResourceType "docs" `
            -ResourceLink $docLink -MasterKey $masterKey `
            -Extra @{
                "x-ms-documentdb-partitionkey" = "[`"$docId`"]"
            }
        # Remove query-specific header
        $dHeaders.Remove("x-ms-documentdb-isquery")

        try {
            Invoke-RestMethod -Method DELETE -Uri "$baseUri/$docLink" `
                -Headers $dHeaders | Out-Null
            $deleteCount++
        }
        catch {
            $status = $_.Exception.Response.StatusCode.value__
            Write-Host "    DELETE FAILED for $docId (HTTP $status)" -ForegroundColor Red
        }
    }

    Write-Host "    DELETED $deleteCount of $($docs.Count)" -ForegroundColor Green
}

Write-Host ""

# ============================================================================
# 4. Close Cosmos public access (retry with backoff)
# ============================================================================
Write-Host "Closing Cosmos DB public access..." -ForegroundColor Yellow

$closed = $false
for ($attempt = 1; $attempt -le 6; $attempt++) {
    Start-Sleep -Seconds (15 * $attempt)
    try {
        $armToken = (az account get-access-token --query accessToken -o tsv)
        $armHeaders = @{ "Authorization" = "Bearer $armToken"; "Content-Type" = "application/json" }
        Invoke-RestMethod -Method PATCH -Uri $armUri -Headers $armHeaders `
            -Body '{"properties":{"publicNetworkAccess":"Disabled","ipRules":[]}}' | Out-Null
        $closed = $true
        break
    }
    catch {
        Write-Host "  Attempt $attempt/6 — operation in progress, retrying..." -ForegroundColor Gray
    }
}

if ($closed) {
    Write-Host "  Public access disabled" -ForegroundColor Green
} else {
    Write-Host "  WARNING: Could not disable. Run manually:" -ForegroundColor Red
    Write-Host "  az cosmosdb update -n $accountName -g $rgName --public-network-access DISABLED"
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
Write-Host "Affected users can now log in fresh via SSO."
