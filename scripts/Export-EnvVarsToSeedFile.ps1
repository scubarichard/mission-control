# ============================================================
# Export-EnvVarsToSeedFile.ps1
# ─────────────────────────────────────────────────────────────
# ONE-TIME USE. Reads current API keys from the Azure Container
# App env vars and writes them to a local seed file that
# Install-CredentialVaultArchitecture.ps1 reads on first run.
#
# After KV migration is complete, delete the seed file.
# Run as: .\Export-EnvVarsToSeedFile.ps1
# ─────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

$ResourceGroup = "rg-dax-dakona-pilot"
$ContainerApp  = "ca-dax-mcp-dakona-pilot"
$SeedFile      = "$PSScriptRoot\kv-seed.json"

# Map: Container App env var name => Key Vault secret name
$EnvToKV = @{
    "N8N_API_KEY"           = "n8n-api-key"
    "VINCE_N8N_API_KEY"     = "vince-n8n-api-key"
    "FMP_API_KEY"           = "fmp-api-key"
    "FINNHUB_API_KEY"       = "finnhub-api-key"
    "CLICKUP_API_KEY"       = "clickup-api-key"
    "MAKE_API_KEY"          = "make-api-key"
    "RPE_SLACK_TOKEN"       = "rpe-slack-token"
    "DESKTOP_BRIDGE_SECRET" = "desktop-bridge-secret"
    "MONGO_URI"             = "cosmos-connection-string"
}

Write-Host "=== DAX Env Var Export to KV Seed File ===" -ForegroundColor Cyan

# Verify az CLI
$account = az account show --query name -o tsv
Write-Host "Azure account: $account" -ForegroundColor Gray

# Pull all env vars from Container App as JSON
Write-Host "`nReading env vars from: $ContainerApp..." -ForegroundColor Yellow
$envVarsJson = az containerapp show `
    --name $ContainerApp `
    --resource-group $ResourceGroup `
    --query "properties.template.containers[0].env" `
    -o json

$envVars = $envVarsJson | ConvertFrom-Json

# Build a lookup hashtable: name => value
$envLookup = @{}
foreach ($ev in $envVars) {
    if ($ev.value) {
        $envLookup[$ev.name] = $ev.value
    }
}

# Build seed object
$seed = @{}
$found   = @()
$missing = @()

foreach ($envName in $EnvToKV.Keys) {
    $kvName = $EnvToKV[$envName]
    if ($envLookup.ContainsKey($envName) -and -not [string]::IsNullOrWhiteSpace($envLookup[$envName])) {
        $seed[$kvName] = $envLookup[$envName]
        $found += $envName
    } else {
        $missing += $envName
    }
}

# Write seed file
$seed | ConvertTo-Json -Depth 3 | Set-Content -Path $SeedFile -Encoding UTF8

Write-Host "`n✓ Seed file written: $SeedFile" -ForegroundColor Green
Write-Host "  Exported : $($found.Count) — $($found -join ', ')" -ForegroundColor Green

if ($missing.Count -gt 0) {
    Write-Host "  Not found: $($missing.Count) — $($missing -join ', ')" -ForegroundColor Yellow
    Write-Host "  (These will be skipped during KV migration — add manually if needed)" -ForegroundColor Gray
}

Write-Host "`n⚠  SECURITY: This file contains plaintext secrets." -ForegroundColor Red
Write-Host "   Delete it immediately after running Install-CredentialVaultArchitecture.ps1" -ForegroundColor Red
Write-Host "   Path: $SeedFile`n" -ForegroundColor Red
