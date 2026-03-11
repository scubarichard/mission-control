<#
.SYNOPSIS
    Generates cryptographically random session secrets for LibreChat,
    stores them in Key Vault, and wires them into the Container App.

.DESCRIPTION
    Creates/updates 4 secrets in Key Vault:
    - jwt-secret          (64 hex chars)
    - jwt-refresh-secret  (64 hex chars)
    - creds-key           (32 hex chars)
    - creds-iv            (16 hex chars)

    Then adds them as KV-backed secrets on the Container App and sets
    the corresponding environment variables. A new revision is created
    automatically, picking up the secret values.

    Idempotent: safe to run multiple times. Each run generates new values,
    which invalidates existing user sessions (users must re-authenticate).

    Requires: Key Vault Secrets Officer role on the target Key Vault.

.PARAMETER ClientName
    Short client identifier.

.PARAMETER KeyVaultName
    Key Vault name. Defaults to derived name matching key-vault.bicep naming.

.EXAMPLE
    ./Deploy-LibreChatSecrets.ps1 -ClientName acme
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $ClientName,
    [string] $KeyVaultName = ""
)

$ErrorActionPreference = 'Stop'

# ---------- Derive names ----------
$rgName = "rg-dax-$ClientName"
$caName = "ca-dax-$ClientName"
$identityName = "id-dax-$ClientName"

if (-not $KeyVaultName) {
    $kvRaw = ("kv-dax-$ClientName" -replace '-', '')
    if ($kvRaw.Length -gt 24) { $KeyVaultName = $kvRaw.Substring(0, 24) } else { $KeyVaultName = $kvRaw }
}

Write-Host "=== DAX LibreChat Session Secrets ===" -ForegroundColor Cyan
Write-Host "Client:        $ClientName"
Write-Host "Key Vault:     $KeyVaultName"
Write-Host "Container App: $caName"

# ---------- Helper: generate crypto-random hex string ----------
function New-RandomHex([int]$Bytes) {
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $buf = New-Object byte[] $Bytes
    $rng.GetBytes($buf)
    return ($buf | ForEach-Object { $_.ToString("x2") }) -join ''
}

# ============================================================================
# 1. Generate and store secrets in Key Vault
# ============================================================================

$secrets = @(
    @{ Name = 'jwt-secret';         Bytes = 32; Desc = 'JWT signing secret' }
    @{ Name = 'jwt-refresh-secret'; Bytes = 32; Desc = 'JWT refresh token secret' }
    @{ Name = 'creds-key';          Bytes = 16; Desc = 'Credential encryption key (32 hex)' }
    @{ Name = 'creds-iv';           Bytes = 8;  Desc = 'Credential encryption IV (16 hex)' }
)

foreach ($s in $secrets) {
    $value = New-RandomHex -Bytes $s.Bytes
    Write-Host "`nSetting $($s.Name) ($($s.Desc))..." -ForegroundColor Yellow

    az keyvault secret set `
        --vault-name "$KeyVaultName" `
        --name "$($s.Name)" `
        --value "$value" `
        --description "$($s.Desc)" `
        | Out-Null

    Write-Host "  $($s.Name) -> Key Vault ($($value.Length) hex chars)" -ForegroundColor Green
}

# ============================================================================
# 2. Wire secrets into Container App
# ============================================================================

Write-Host "`nWiring secrets into Container App ($caName)..." -ForegroundColor Yellow

$kvUri = "https://$KeyVaultName.vault.azure.net/"
$identityId = az identity show -n "$identityName" -g "$rgName" --query "id" -o tsv

az containerapp secret set -n "$caName" -g "$rgName" --secrets `
    "jwt-secret=keyvaultref:${kvUri}secrets/jwt-secret,identityref:${identityId}" `
    "jwt-refresh-secret=keyvaultref:${kvUri}secrets/jwt-refresh-secret,identityref:${identityId}" `
    "creds-key=keyvaultref:${kvUri}secrets/creds-key,identityref:${identityId}" `
    "creds-iv=keyvaultref:${kvUri}secrets/creds-iv,identityref:${identityId}" `
    | Out-Null

az containerapp update -n "$caName" -g "$rgName" --set-env-vars `
    "JWT_SECRET=secretref:jwt-secret" `
    "JWT_REFRESH_SECRET=secretref:jwt-refresh-secret" `
    "CREDS_KEY=secretref:creds-key" `
    "CREDS_IV=secretref:creds-iv" `
    | Out-Null

Write-Host "  Container App updated with session secrets." -ForegroundColor Green

# ============================================================================
# 3. Summary
# ============================================================================

Write-Host "`n=== Session secrets deployed ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Key Vault secrets created and wired into $caName."
Write-Host "A new Container App revision was created automatically."
Write-Host ""
