<#
.SYNOPSIS
    Provisions Bing Search API and updates the DAX Router with web search.

.DESCRIPTION
    1. Creates a Bing Search v7 resource in Azure (S1 pay-per-use, ~$3/1000 queries)
    2. Retrieves the API key
    3. Stores the key in Key Vault
    4. Runs the n8n workflow update script

.PARAMETER ClientName
    Short client identifier (e.g. dakona-pilot).

.EXAMPLE
    ./Deploy-WebSearch.ps1 -ClientName dakona-pilot
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $ClientName
)

$ErrorActionPreference = 'Stop'

# ---------- Derive names ----------
$rgName   = "rg-dax-$ClientName"
$bingName = "bing-dax-$ClientName"
$subId    = (az account show --query "id" -o tsv)

if (-not $ClientName) {
    $kvRaw = ("kv-dax-$ClientName" -replace '-', '')
    if ($kvRaw.Length -gt 24) { $kvName = $kvRaw.Substring(0, 24) } else { $kvName = $kvRaw }
} else {
    $kvRaw = ("kv-dax-$ClientName" -replace '-', '')
    if ($kvRaw.Length -gt 24) { $kvName = $kvRaw.Substring(0, 24) } else { $kvName = $kvRaw }
}

Write-Host "=== DAX Web Search Deployment ===" -ForegroundColor Cyan
Write-Host "Client:    $ClientName"
Write-Host "RG:        $rgName"
Write-Host "Bing:      $bingName"
Write-Host "Key Vault: $kvName"

# ============================================================================
# 1. Create Bing Search resource
# ============================================================================

Write-Host "`nRegistering Microsoft.Bing provider..." -ForegroundColor Yellow
az provider register --namespace Microsoft.Bing --wait | Out-Null
Write-Host "  Registered." -ForegroundColor Green

Write-Host "`nCreating Bing Search resource..." -ForegroundColor Yellow

$existing = $null
try {
    $existing = az resource show `
        --resource-group $rgName `
        --resource-type "Microsoft.Bing/accounts" `
        --name $bingName `
        --query "id" -o tsv 2>$null
} catch { }

if ($existing) {
    Write-Host "  Bing Search resource already exists." -ForegroundColor DarkGray
} else {
    $bodyFile = [System.IO.Path]::GetTempFileName()
    @{location="global"; kind="Bing.Search.v7"; sku=@{name="S1"}} | ConvertTo-Json -Compress | Set-Content -Path $bodyFile -Encoding utf8
    az rest --method PUT `
        --url "https://management.azure.com/subscriptions/$subId/resourceGroups/$rgName/providers/Microsoft.Bing/accounts/${bingName}?api-version=2020-06-10" `
        --headers "Content-Type=application/json" `
        --body "@$bodyFile" `
        | Out-Null
    Remove-Item $bodyFile -ErrorAction SilentlyContinue

    if ($LASTEXITCODE -ne 0) { Write-Error "Failed to create Bing Search resource." }
    Write-Host "  Created: $bingName (S1 pay-per-use)" -ForegroundColor Green
}

# ============================================================================
# 2. Retrieve API key
# ============================================================================

Write-Host "`nRetrieving Bing API key..." -ForegroundColor Yellow

$bingKey = az rest `
    --method POST `
    --url "https://management.azure.com/subscriptions/$subId/resourceGroups/$rgName/providers/Microsoft.Bing/accounts/$bingName/listKeys?api-version=2020-06-10" `
    --query "key1" -o tsv

if (-not $bingKey) {
    Write-Error "Failed to retrieve Bing API key."
}

Write-Host "  Key: $($bingKey.Substring(0,8))..." -ForegroundColor Green

# ============================================================================
# 3. Store in Key Vault
# ============================================================================

Write-Host "`nStoring key in Key Vault ($kvName)..." -ForegroundColor Yellow

az keyvault secret set `
    --vault-name $kvName `
    --name "bing-search-key" `
    --value $bingKey `
    | Out-Null

Write-Host "  Stored as 'bing-search-key'" -ForegroundColor Green

# ============================================================================
# 4. Update n8n workflow
# ============================================================================

Write-Host "`nUpdating DAX Router workflow in n8n..." -ForegroundColor Yellow

node "$PSScriptRoot/update-router-websearch.js"

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Workflow updated successfully." -ForegroundColor Green
} else {
    Write-Host "  Workflow update failed. Run manually:" -ForegroundColor Red
    Write-Host "  node scripts/update-router-websearch.js"
}

# ============================================================================
# 5. Summary
# ============================================================================

Write-Host "`n=== Web Search Deployment Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Bing Search:  $bingName (provisioned, key in KV for future Bing Grounding)"
Write-Host "SKU:          S1 (pay-per-use, ~`$3/1000 queries)"
Write-Host "Key Vault:    $kvName/bing-search-key"
Write-Host ""
Write-Host "DAX Router market data flow:"
Write-Host "  Detect Tickers -> Fetch Quote (Yahoo Finance) -> Build Context -> Azure OpenAI"
Write-Host "Market queries get live price data injected into the LLM context."
Write-Host ""
