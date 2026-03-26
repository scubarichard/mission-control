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

# Map: Container App env var / secret name => Key Vault secret name
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

# ── Step 1: Read plain env vars ───────────────────────────────
Write-Host "`nReading plain env vars from: $ContainerApp..." -ForegroundColor Yellow
$envVarsJson = az containerapp show `
    --name $ContainerApp `
    --resource-group $ResourceGroup `
    --query "properties.template.containers[0].env" `
    -o json

$envVars = $envVarsJson | ConvertFrom-Json

$envLookup = @{}
foreach ($ev in $envVars) {
    if ($ev.value) {
        $envLookup[$ev.name] = $ev.value
    }
}
Write-Host "  Found $($envLookup.Count) plain env vars" -ForegroundColor Gray

# ── Step 2: Read Container App secrets ───────────────────────
Write-Host "Reading Container App secrets from: $ContainerApp..." -ForegroundColor Yellow
$secretsJson = az containerapp secret list `
    --name $ContainerApp `
    --resource-group $ResourceGroup `
    -o json

$secretsList = $secretsJson | ConvertFrom-Json

foreach ($s in $secretsList) {
    $secretName = $s.name
    # Secret names in Container Apps use hyphens; env vars use underscores
    # Try to match by converting hyphens to underscores for lookup
    $envEquivalent = $secretName.ToUpper().Replace("-","_")

    # Fetch the actual secret value
    try {
        $secretValue = (az containerapp secret show `
            --name $ContainerApp `
            --resource-group $ResourceGroup `
            --secret-name $secretName `
            --query "value" -o tsv 2>$null).Trim()

        if (-not [string]::IsNullOrWhiteSpace($secretValue)) {
            # Store under both the original secret name and env var equivalent
            $envLookup[$secretName]      = $secretValue
            $envLookup[$envEquivalent]   = $secretValue
        }
    } catch {
        Write-Host "  Could not read secret: $secretName" -ForegroundColor Yellow
    }
}
Write-Host "  Total values available (env + secrets): $($envLookup.Count)" -ForegroundColor Gray

# ── Step 3: Build seed object ─────────────────────────────────
$seed    = @{}
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

# ── Step 4: Write seed file ───────────────────────────────────
$seed | ConvertTo-Json -Depth 3 | Set-Content -Path $SeedFile -Encoding UTF8

Write-Host "`n[OK] Seed file written: $SeedFile" -ForegroundColor Green
Write-Host "  Exported : $($found.Count) - $($found -join ', ')" -ForegroundColor Green

if ($missing.Count -gt 0) {
    Write-Host "  Not found: $($missing.Count) - $($missing -join ', ')" -ForegroundColor Yellow
    Write-Host "  You can add these manually to: $SeedFile" -ForegroundColor Gray
    Write-Host "  Format: { ""secret-name"": ""value"", ... }" -ForegroundColor Gray
}

Write-Host "`n[!] SECURITY: This file contains plaintext secrets." -ForegroundColor Red
Write-Host "    Delete it immediately after running Install-CredentialVaultArchitecture.ps1" -ForegroundColor Red
Write-Host "    Path: $SeedFile`n" -ForegroundColor Red
