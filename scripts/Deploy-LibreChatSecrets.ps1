<#
.SYNOPSIS
    Generates cryptographically random session secrets for LibreChat and stores them in Key Vault.

.DESCRIPTION
    Replaces the deterministic seed values created by key-vault.bicep with
    production-grade crypto-random secrets:
    - jwt-secret          (64 hex chars)
    - jwt-refresh-secret  (64 hex chars)
    - creds-key           (32 hex chars)
    - creds-iv            (16 hex chars)

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

# ---------- Derive Key Vault name if not provided ----------
if (-not $KeyVaultName) {
    $kvRaw = ("kv-dax-$ClientName" -replace '-', '')
    $KeyVaultName = if ($kvRaw.Length -gt 24) { $kvRaw.Substring(0, 24) } else { $kvRaw }
}

Write-Host "=== DAX LibreChat Session Secrets ===" -ForegroundColor Cyan
Write-Host "Client:    $ClientName"
Write-Host "Key Vault: $KeyVaultName"

# ---------- Helper: generate crypto-random hex string ----------
function New-RandomHex([int]$Bytes) {
    $buf = [byte[]]::new($Bytes)
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($buf)
    return ($buf | ForEach-Object { $_.ToString("x2") }) -join ''
}

# ---------- Generate and store secrets ----------

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
        --vault-name $KeyVaultName `
        --name $s.Name `
        --value $value `
        --description $s.Desc `
        | Out-Null

    Write-Host "  $($s.Name) -> Key Vault ($($value.Length) hex chars)" -ForegroundColor Green
}

Write-Host "`n=== Session secrets stored ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next: restart the Container App to pick up new secrets:" -ForegroundColor Yellow
Write-Host "  az containerapp revision restart -n ca-dax-$ClientName -g rg-dax-$ClientName --revision <revision>"
Write-Host ""
