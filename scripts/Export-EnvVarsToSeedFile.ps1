# ============================================================
# Export-EnvVarsToSeedFile.ps1
# -------------------------------------------------------------
# ONE-TIME USE. Reads current API keys from the Azure Container
# App env vars AND secrets and writes them to a local seed file
# that Install-CredentialVaultArchitecture.ps1 reads on first run.
#
# After KV migration is complete, delete the seed file.
# Run as: .\Export-EnvVarsToSeedFile.ps1
# ============================================================

$ErrorActionPreference = "Stop"

$ResourceGroup = "rg-dax-dakona-pilot"
$ContainerApp  = "ca-dax-mcp-dakona-pilot"
$SeedFile      = "$PSScriptRoot\kv-seed.json"

# Map: ALL known Container App env var names AND secret names => KV secret name
# Covers both naming conventions (underscores and hyphens)
$ToKV = @{
    # Plain env var names
    "N8N_API_KEY"            = "n8n-api-key"
    "VINCE_N8N_API_KEY"      = "vince-n8n-api-key"
    "FMP_API_KEY"            = "fmp-api-key"
    "FINNHUB_API_KEY"        = "finnhub-api-key"
    "CLICKUP_API_KEY"        = "clickup-api-key"
    "MAKE_API_KEY"           = "make-api-key"
    "RPE_SLACK_TOKEN"        = "rpe-slack-token"
    "DESKTOP_BRIDGE_SECRET"  = "desktop-bridge-secret"
    "MONGO_URI"              = "cosmos-connection-string"
    # Container App secret names (as shown by az containerapp secret list)
    "n8n-api-key"            = "n8n-api-key"
    "vince-n8n-api-key"      = "vince-n8n-api-key"
    "fmp-api-key"            = "fmp-api-key"
    "finnhub-api-key"        = "finnhub-api-key"
    "clickup-api-key"        = "clickup-api-key"
    "make-api-key"           = "make-api-key"
    "rpe-slack-bot-token"    = "rpe-slack-token"
    "rpe-pit-token"          = "rpe-pit-token"
    "github-token"           = "github-token"
    "asana-api-token"        = "asana-api-token"
    "desktop-bridge-secret"  = "desktop-bridge-secret"
    "cosmos-connection-string" = "cosmos-connection-string"
}

Write-Host "=== DAX Env Var Export to KV Seed File ===" -ForegroundColor Cyan

# Verify az CLI
$account = az account show --query name -o tsv
Write-Host "Azure account: $account" -ForegroundColor Gray

$valueLookup = @{}

# ── Step 1: Read plain env vars ───────────────────────────────
Write-Host "`nReading plain env vars from: $ContainerApp..." -ForegroundColor Yellow
$envVarsJson = az containerapp show `
    --name $ContainerApp `
    --resource-group $ResourceGroup `
    --query "properties.template.containers[0].env" `
    -o json
$envVars = $envVarsJson | ConvertFrom-Json
foreach ($ev in $envVars) {
    if ($ev.value -and -not [string]::IsNullOrWhiteSpace($ev.value)) {
        $valueLookup[$ev.name] = $ev.value
    }
}
Write-Host "  Found $($valueLookup.Count) plain env vars" -ForegroundColor Gray

# ── Step 2: Read Container App secrets by name ───────────────
Write-Host "Reading Container App secrets..." -ForegroundColor Yellow
$secretsListJson = az containerapp secret list `
    --name $ContainerApp `
    --resource-group $ResourceGroup `
    -o json
$secretsList = $secretsListJson | ConvertFrom-Json

foreach ($s in $secretsList) {
    $sName = $s.name
    Write-Host "  Fetching secret: $sName" -ForegroundColor Gray
    try {
        $val = (az containerapp secret show `
            --name $ContainerApp `
            --resource-group $ResourceGroup `
            --secret-name $sName `
            --query "value" -o tsv 2>$null).Trim()
        if (-not [string]::IsNullOrWhiteSpace($val)) {
            $valueLookup[$sName] = $val
        }
    } catch {
        Write-Host "  Could not read secret: $sName" -ForegroundColor Yellow
    }
}
Write-Host "  Total values available: $($valueLookup.Count)" -ForegroundColor Gray

# ── Step 3: Build seed object (deduplicated by KV secret name) ─
$seed  = @{}
$found = @()

foreach ($sourceName in $ToKV.Keys) {
    $kvName = $ToKV[$sourceName]
    if ($valueLookup.ContainsKey($sourceName) -and -not $seed.ContainsKey($kvName)) {
        $seed[$kvName] = $valueLookup[$sourceName]
        $found += "$sourceName -> $kvName"
    }
}

# ── Step 4: Write seed file ───────────────────────────────────
$seed | ConvertTo-Json -Depth 3 | Set-Content -Path $SeedFile -Encoding UTF8

Write-Host "`n[OK] Seed file written: $SeedFile" -ForegroundColor Green
Write-Host "  Exported $($seed.Count) secrets:" -ForegroundColor Green
$found | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }

$allKVNames = $ToKV.Values | Sort-Object -Unique
$notFound = $allKVNames | Where-Object { -not $seed.ContainsKey($_) }
if ($notFound.Count -gt 0) {
    Write-Host "`n  Not found ($($notFound.Count)): $($notFound -join ', ')" -ForegroundColor Yellow
    Write-Host "  Add these manually to $SeedFile if needed" -ForegroundColor Gray
}

Write-Host "`n[!] SECURITY: This file contains plaintext secrets." -ForegroundColor Red
Write-Host "    Delete it immediately after running Install-CredentialVaultArchitecture.ps1" -ForegroundColor Red
Write-Host "    Path: $SeedFile`n" -ForegroundColor Red
