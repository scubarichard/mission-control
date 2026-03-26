# ============================================================
# Install-CredentialVaultArchitecture.ps1
# ─────────────────────────────────────────────────────────────
# ONE-TIME SETUP. Run as Administrator.
#
# 1. Seeds all API credentials into Key Vault
# 2. Sets MCP_GATEWAY_TOKEN as a permanent env var on the Container App
# 3. Removes old MCP_AUTH_TOKEN env var (no longer used)
# 4. Grants Container App managed identity access to Key Vault
# 5. Deploys updated server.js via ACR build
# 6. Schedules monthly credential rotation via Task Scheduler
# ─────────────────────────────────────────────────────────────
param(
    [switch]$SkipDeploy,    # Skip the ACR build/deploy step
    [switch]$SkipSchedule   # Skip Task Scheduler registration
)

$ErrorActionPreference = "Stop"

$KVName       = "kvdaxdakonapilot"
$RG           = "rg-dax-dakona-pilot"
$ContainerApp = "ca-dax-mcp-dakona-pilot"
$LogFile      = "$PSScriptRoot\vault-setup.log"
$Repo         = "P:\_clients\dakona\dax"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $ts   = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] [$Level] $Message"
    Write-Host $line -ForegroundColor $(if ($Level -eq "ERROR") { "Red" } elseif ($Level -eq "WARN") { "Yellow" } else { "Cyan" })
    Add-Content -Path $LogFile -Value $line
}

function New-SecureToken {
    $bytes = New-Object Byte[] 32
    [Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes) -replace '[+/=]', { @{'+'=>'-';'/'=>'_';'='=>''}[$_] }
}

function Set-KVSecret {
    param([string]$Name, [string]$Value)
    az keyvault secret set --vault-name $KVName --name $Name --value $Value --output none 2>&1 | Out-Null
    Write-Log "  ✓ KV secret set: $Name"
}

# ── Step 0: Verify az CLI ─────────────────────────────────────
Write-Log "=== DAX Credential Vault Architecture — One-Time Setup ==="
$account = az account show --query name -o tsv
Write-Log "Azure account: $account"

# ── Step 1: Grant managed identity Key Vault access ───────────
Write-Log "`n[1/6] Granting Container App managed identity access to Key Vault..."
$principalId = az containerapp show -n $ContainerApp -g $RG --query identity.principalId -o tsv
if (-not $principalId) {
    Write-Log "  Enabling system-assigned managed identity on Container App..."
    az containerapp identity assign -n $ContainerApp -g $RG --system-assigned --output none
    Start-Sleep -Seconds 10
    $principalId = az containerapp show -n $ContainerApp -g $RG --query identity.principalId -o tsv
}
Write-Log "  Principal ID: $principalId"

$kvResourceId = az keyvault show --name $KVName --query id -o tsv
az role assignment create `
    --role "Key Vault Secrets User" `
    --assignee-object-id $principalId `
    --assignee-principal-type ServicePrincipal `
    --scope $kvResourceId `
    --output none 2>&1 | Out-Null
Write-Log "  ✓ Key Vault Secrets User role assigned"

# ── Step 2: Seed secrets into Key Vault ──────────────────────
Write-Log "`n[2/6] Seeding credentials into Key Vault..."
Write-Host "`nPlease enter your API credentials (paste existing values):" -ForegroundColor Yellow

$secrets = @{
    "n8n-api-key"            = $null
    "vince-n8n-api-key"      = $null
    "fmp-api-key"            = $null
    "finnhub-api-key"        = $null
    "clickup-api-key"        = $null
    "make-api-key"           = $null
    "rpe-slack-token"        = $null
    "cosmos-connection-string" = $null
}

foreach ($name in $secrets.Keys) {
    $val = Read-Host "  $name"
    if (-not [string]::IsNullOrWhiteSpace($val)) {
        Set-KVSecret -Name $name -Value $val.Trim()
    } else {
        Write-Log "  SKIP: $name (blank)" "WARN"
    }
}

# Desktop bridge secret — auto-generate
$bridgeSecret = New-SecureToken
Set-KVSecret -Name "desktop-bridge-secret" -Value $bridgeSecret
Write-Log "  ✓ desktop-bridge-secret auto-generated"

# ── Step 3: Generate and store permanent gateway token ────────
Write-Log "`n[3/6] Setting permanent MCP gateway token..."
$existingGateway = (az keyvault secret show --vault-name $KVName --name "mcp-gateway-token" --query value -o tsv 2>$null).Trim()
if (-not $existingGateway) {
    $gatewayToken = New-SecureToken
    Set-KVSecret -Name "mcp-gateway-token" -Value $gatewayToken
    Write-Log "  ✓ New gateway token generated and stored in KV"
} else {
    $gatewayToken = $existingGateway
    Write-Log "  ✓ Existing gateway token found in KV — keeping"
}

# ── Step 4: Update Container App env vars ────────────────────
Write-Log "`n[4/6] Updating Container App env vars..."
# Set GATEWAY_TOKEN as env var (read once at startup — this is the only env var that matters)
az containerapp update `
    --name $ContainerApp `
    --resource-group $RG `
    --set-env-vars "MCP_GATEWAY_TOKEN=$gatewayToken" `
    --remove-env-vars "MCP_AUTH_TOKEN" `
    --output none 2>&1 | Out-Null
Write-Log "  ✓ MCP_GATEWAY_TOKEN set, MCP_AUTH_TOKEN removed"

# Remove old secrets-as-env-vars (they now live in KV only)
$oldVars = @("N8N_API_KEY","VINCE_N8N_API_KEY","FMP_API_KEY","FINNHUB_API_KEY","CLICKUP_API_KEY","MAKE_API_KEY","RPE_SLACK_TOKEN","DESKTOP_BRIDGE_SECRET")
az containerapp update `
    --name $ContainerApp `
    --resource-group $RG `
    --remove-env-vars ($oldVars -join " ") `
    --output none 2>&1 | Out-Null
Write-Log "  ✓ Removed old credential env vars (now served from Key Vault)"

# ── Step 5: Deploy updated server ─────────────────────────────
if (-not $SkipDeploy) {
    Write-Log "`n[5/6] Building and deploying updated MCP server..."
    $contextPath = "$Repo\mcp"
    az acr build `
        --registry acrdaxdakona `
        -g $RG `
        --image mcp-server:latest `
        --file "$contextPath\Dockerfile" `
        $contextPath
    az containerapp update `
        --name $ContainerApp `
        --resource-group $RG `
        --image "acrdaxdakona.azurecr.io/mcp-server:latest" `
        --output none
    Write-Log "  ✓ Deployed"
} else {
    Write-Log "`n[5/6] SKIPPED deploy (--SkipDeploy)"
}

# ── Step 6: Register monthly rotation schedule ────────────────
if (-not $SkipSchedule) {
    Write-Log "`n[6/6] Registering credential rotation schedule..."
    $taskName   = "DAX-Credential-Vault-Rotation"
    $scriptPath = "$Repo\scripts\Rotate-CredentialVault.ps1"

    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    }

    $action   = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -NonInteractive -File `"$scriptPath`" -Force"
    $trigger  = New-ScheduledTaskTrigger -Monthly -DaysOfMonth 1 -At "3:00AM"
    $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 1) -StartWhenAvailable -WakeToRun
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Highest

    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
        -Description "Rotates DAX API credentials in Key Vault monthly. MCP server auto-picks up within 6h." -Force | Out-Null

    Write-Log "  ✓ Task '$taskName' scheduled for 1st of each month at 3:00 AM"
} else {
    Write-Log "`n[6/6] SKIPPED schedule (--SkipSchedule)"
}

# ── Final output ──────────────────────────────────────────────
$newUrl = "https://mcp.dakona.net/mcp?token=$gatewayToken"

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "  SETUP COMPLETE" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  PERMANENT Claude.ai MCP URL (update once, never again):" -ForegroundColor Yellow
Write-Host "  $newUrl" -ForegroundColor White
Write-Host ""
Write-Host "  What happens now:" -ForegroundColor Cyan
Write-Host "  - Internal credentials live in Key Vault only" -ForegroundColor White
Write-Host "  - MCP server refreshes them every 6 hours automatically" -ForegroundColor White
Write-Host "  - Monthly rotation runs 1st of each month at 3 AM" -ForegroundColor White
Write-Host "  - Claude.ai URL NEVER needs to change again" -ForegroundColor White
Write-Host ""
Write-Host "  Gateway token stored in KV: mcp-gateway-token" -ForegroundColor Gray
Write-Host "  Log: $LogFile" -ForegroundColor Gray
Write-Host "============================================================`n" -ForegroundColor Green

Write-Log "Setup complete. Gateway token stored. URL: $newUrl"
