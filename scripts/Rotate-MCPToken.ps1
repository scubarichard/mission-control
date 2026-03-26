# ============================================================
# DAX MCP Token Rotator
# Generates a new MCP_AUTH_TOKEN, updates Azure Container App,
# and logs the new token so Claude.ai can be updated.
#
# Schedule: Run monthly via Windows Task Scheduler
# Usage:    .\Rotate-MCPToken.ps1 [-Force]
# ============================================================

param(
    [switch]$Force  # Skip confirmation prompt
)

$ErrorActionPreference = "Stop"

# ── Config ────────────────────────────────────────────────────────────
$ResourceGroup    = "rg-dax-dakona-pilot"
$ContainerApp     = "ca-dax-mcp-dakona-pilot"
$KeyVaultName     = "kvdaxdakonapilot"
$SecretName       = "mcp-auth-token"
$LogFile          = "$PSScriptRoot\token-rotation.log"
$ClaudeAIBaseUrl  = "https://mcp.dakona.net/mcp"

# ── Logging ───────────────────────────────────────────────────────────
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] [$Level] $Message"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line
}

# ── Generate token ────────────────────────────────────────────────────
function New-SecureToken {
    $bytes = New-Object Byte[] 32
    [Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes) -replace '[+/=]', { @{'+'=>'-';'/'=>'_';'='=>''}[$_] }
}

# ── Main ──────────────────────────────────────────────────────────────
Write-Log "=== DAX MCP Token Rotation Started ==="

# Check az CLI
try {
    $account = az account show --query name -o tsv 2>&1
    Write-Log "Azure account: $account"
} catch {
    Write-Log "az CLI not logged in. Run: az login" "ERROR"
    exit 1
}

# Generate new token
$NewToken = New-SecureToken
Write-Log "New token generated (length: $($NewToken.Length))"

if (-not $Force) {
    $confirm = Read-Host "`nRotate MCP token and restart container app? (y/N)"
    if ($confirm -notmatch '^[Yy]') {
        Write-Log "Rotation cancelled by user."
        exit 0
    }
}

# Store in Key Vault
Write-Log "Storing new token in Key Vault: $KeyVaultName / $SecretName"
az keyvault secret set `
    --vault-name $KeyVaultName `
    --name $SecretName `
    --value $NewToken `
    --output none
Write-Log "Key Vault updated."

# Update Container App env var
Write-Log "Updating Container App: $ContainerApp"
az containerapp update `
    --name $ContainerApp `
    --resource-group $ResourceGroup `
    --set-env-vars "MCP_AUTH_TOKEN=$NewToken" `
    --output none
Write-Log "Container App env var updated."

# Force new revision to pick up the change
Write-Log "Triggering new revision..."
az containerapp revision restart `
    --name $ContainerApp `
    --resource-group $ResourceGroup `
    --revision (az containerapp revision list -n $ContainerApp -g $ResourceGroup --query "[0].name" -o tsv) `
    --output none 2>$null

# Wait for container to be healthy
Write-Log "Waiting for container to become healthy..."
$maxAttempts = 12
$attempt = 0
$healthy = $false
Start-Sleep -Seconds 10

while ($attempt -lt $maxAttempts -and -not $healthy) {
    $attempt++
    try {
        $health = Invoke-RestMethod -Uri "https://mcp.dakona.net/health" -TimeoutSec 5
        if ($health.status -eq "ok") {
            $healthy = $true
            Write-Log "Container healthy after $attempt attempt(s)."
        }
    } catch {
        Write-Log "Health check attempt $attempt/$maxAttempts failed — waiting 10s..."
        Start-Sleep -Seconds 10
    }
}

if (-not $healthy) {
    Write-Log "WARNING: Container did not become healthy within expected time. Check Azure portal." "WARN"
}

# Output new Claude.ai URL
$NewUrl = "${ClaudeAIBaseUrl}?token=${NewToken}"
Write-Log "=== ROTATION COMPLETE ==="
Write-Log "New Claude.ai MCP URL:"
Write-Log "  $NewUrl"
Write-Log "ACTION REQUIRED: Update this URL in Claude.ai Settings → Integrations → Dax MCP Server"

# Save new URL to a file for easy copy-paste
$urlFile = "$PSScriptRoot\new-mcp-url.txt"
Set-Content -Path $urlFile -Value $NewUrl
Write-Log "New URL also saved to: $urlFile"

# Output to console prominently
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  NEW MCP URL (update Claude.ai now):" -ForegroundColor Yellow
Write-Host "  $NewUrl" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan
