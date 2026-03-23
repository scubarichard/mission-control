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

Write-Host "`nCreating Bing Search resource..." -ForegroundColor Yellow

$existing = az resource show `
    --resource-group $rgName `
    --resource-type "Microsoft.Bing/accounts" `
    --name $bingName `
    --query "id" -o tsv 2>$null

if ($existing) {
    Write-Host "  Bing Search resource already exists." -ForegroundColor DarkGray
} else {
    az resource create `
        --resource-group $rgName `
        --resource-type "Microsoft.Bing/accounts" `
        --name $bingName `
        --location "global" `
        --kind "Bing.Search.v7" `
        --properties '{}' `
        --sku "S1" `
        | Out-Null

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

$env:BING_API_KEY = $bingKey
node "$PSScriptRoot/update-router-websearch.js"

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Workflow updated successfully." -ForegroundColor Green
} else {
    Write-Host "  Workflow update failed. Run manually:" -ForegroundColor Red
    Write-Host "  BING_API_KEY=$($bingKey.Substring(0,8))... node scripts/update-router-websearch.js"
}

# ============================================================================
# 5. Summary
# ============================================================================

Write-Host "`n=== Web Search Deployment Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Bing Search:  $bingName"
Write-Host "SKU:          S1 (pay-per-use, ~`$3/1000 queries)"
Write-Host "Key Vault:    $kvName/bing-search-key"
Write-Host "Endpoint:     https://api.bing.microsoft.com/v7.0"
Write-Host ""
Write-Host "DAX Router now searches the web for all general queries."
Write-Host "Market data, news, SEC filings, and general knowledge"
Write-Host "are grounded in live Bing results before Azure OpenAI responds."
Write-Host ""
