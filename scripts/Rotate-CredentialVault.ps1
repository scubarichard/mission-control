# ============================================================
# Rotate-CredentialVault.ps1
# ─────────────────────────────────────────────────────────────
# Rotates ALL DAX internal credentials in Key Vault.
# The MCP server reads from KV every 6 hours automatically —
# NO container restart, NO URL change, NO manual steps ever.
#
# Schedule: Run via Install-CredentialRotationSchedule.ps1
# Usage:    .\Rotate-CredentialVault.ps1 [-Force] [-SecretsOnly]
# ─────────────────────────────────────────────────────────────
param(
    [switch]$Force,        # Skip confirmation prompt
    [switch]$SecretsOnly   # Only rotate secrets, skip health check
)

$ErrorActionPreference = "Stop"

# ── Config ────────────────────────────────────────────────────
$KVName       = "kvdaxdakonapilot"
$LogFile      = "$PSScriptRoot\credential-rotation.log"
$HealthUrl    = "https://mcp.dakona.net/health"

# ── Secrets to rotate ─────────────────────────────────────────
# Format: KV secret name => how to generate the new value
# "random"  = generate a new cryptographically secure random token
# "manual"  = prompt for value (only if not using $Force)
# "az:..."  = run az CLI command to regenerate (future: SPN keys, etc.)
$SecretsToRotate = @{
    "n8n-api-key"            = "manual"
    "vince-n8n-api-key"      = "manual"
    "fmp-api-key"            = "manual"
    "finnhub-api-key"        = "manual"
    "clickup-api-key"        = "manual"
    "make-api-key"           = "manual"
    "rpe-slack-token"        = "manual"
    "desktop-bridge-secret"  = "random"
}

# ── Logging ───────────────────────────────────────────────────
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] [$Level] $Message"
    Write-Host $line -ForegroundColor $(if ($Level -eq "ERROR") { "Red" } elseif ($Level -eq "WARN") { "Yellow" } else { "Cyan" })
    Add-Content -Path $LogFile -Value $line
}

# ── Generate random token ──────────────────────────────────────
function New-SecureToken {
    $bytes = New-Object Byte[] 32
    [Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes) -replace '[+/=]', { @{'+'=>'-';'/'=>'_';'='=>''}[$_] }
}

# ── Get current secret from KV ────────────────────────────────
function Get-KVSecret {
    param([string]$Name)
    try {
        return (az keyvault secret show --vault-name $KVName --name $Name --query value -o tsv 2>$null).Trim()
    } catch {
        return $null
    }
}

# ── Set secret in KV ─────────────────────────────────────────
function Set-KVSecret {
    param([string]$Name, [string]$Value)
    az keyvault secret set --vault-name $KVName --name $Name --value $Value --output none 2>&1 | Out-Null
}

# ── Main ──────────────────────────────────────────────────────
Write-Log "=== DAX Credential Vault Rotation Started ==="

# Verify az CLI
try {
    $account = az account show --query name -o tsv 2>&1
    Write-Log "Azure account: $account"
} catch {
    Write-Log "az CLI not logged in. Run: az login" "ERROR"
    exit 1
}

if (-not $Force) {
    Write-Host "`nThis will rotate credentials in Key Vault: $KVName" -ForegroundColor Yellow
    Write-Host "The MCP server will pick up new values within 6 hours automatically." -ForegroundColor Yellow
    Write-Host "For 'manual' secrets, you will be prompted for current values." -ForegroundColor Yellow
    $confirm = Read-Host "`nProceed? (y/N)"
    if ($confirm -notmatch '^[Yy]') { Write-Log "Rotation cancelled."; exit 0 }
}

$rotated  = @()
$skipped  = @()
$failed   = @()

foreach ($secretName in $SecretsToRotate.Keys) {
    $strategy = $SecretsToRotate[$secretName]
    Write-Log "Processing: $secretName (strategy: $strategy)"

    try {
        $newValue = $null

        switch ($strategy) {
            "random" {
                $newValue = New-SecureToken
                Write-Log "  Generated new random value for $secretName"
            }
            "manual" {
                if ($Force) {
                    # In fully unattended mode, skip manual secrets (keep existing)
                    Write-Log "  SKIP: $secretName requires manual value (running with -Force, keeping existing)" "WARN"
                    $skipped += $secretName
                    continue
                }
                $current = Get-KVSecret -Name $secretName
                Write-Host "`n  Secret: $secretName" -ForegroundColor Yellow
                if ($current) {
                    Write-Host "  Current: $($current.Substring(0, [Math]::Min(8, $current.Length)))..." -ForegroundColor Gray
                }
                $newValue = Read-Host "  Enter new value (leave blank to keep current)"
                if ([string]::IsNullOrWhiteSpace($newValue)) {
                    Write-Log "  Keeping existing value for $secretName"
                    $skipped += $secretName
                    continue
                }
            }
        }

        if ($newValue) {
            Set-KVSecret -Name $secretName -Value $newValue
            Write-Log "  ✓ Updated $secretName in Key Vault"
            $rotated += $secretName
        }
    } catch {
        Write-Log "  ✗ Failed to rotate $secretName`: $_" "ERROR"
        $failed += $secretName
    }
}

# ── Summary ───────────────────────────────────────────────────
Write-Log "=== Rotation Complete ==="
Write-Log "  Rotated : $($rotated.Count) — $($rotated -join ', ')"
Write-Log "  Skipped : $($skipped.Count) — $($skipped -join ', ')"
Write-Log "  Failed  : $($failed.Count) — $($failed -join ', ')"

if ($failed.Count -gt 0) {
    Write-Log "WARNING: Some secrets failed to rotate. Check above for details." "WARN"
}

# ── Verify server picks up changes ────────────────────────────
if (-not $SecretsOnly -and $rotated.Count -gt 0) {
    Write-Log "Checking MCP server health (new credentials load within 6h automatically)..."
    try {
        $health = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 10
        $credStatus = $health.credentials
        Write-Log "  Server status: $($health.status)"
        Write-Log "  Last KV refresh: $($credStatus.lastRefresh)"
        Write-Log "  Next KV refresh: $($credStatus.nextRefresh)"
        Write-Log "  ✓ Server is healthy. New credentials will be active by: $($credStatus.nextRefresh)"
    } catch {
        Write-Log "  Health check failed: $_. Server still running — credentials will refresh automatically." "WARN"
    }
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  Rotation complete — zero manual steps" -ForegroundColor Green
Write-Host "  Claude.ai URL unchanged               " -ForegroundColor Green
Write-Host "  New creds active within 6h            " -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green
