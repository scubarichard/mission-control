<#
.SYNOPSIS
    Registers an Entra ID application for LibreChat OpenID Connect SSO.

.DESCRIPTION
    Creates an app registration in the client tenant with:
    - Web redirect URI pointing to the LibreChat Container App
    - Delegated permissions: openid, profile, email (Microsoft Graph)
    - A client secret (stored in Key Vault)
    - Client ID stored in Key Vault

    Requires: Microsoft Graph PowerShell SDK or Azure CLI with
    permissions to create app registrations in the client tenant.

.PARAMETER ClientName
    Short client identifier (matches Key Vault naming: kv-dax-<clientName>).

.PARAMETER LibreChatUrl
    The FQDN of the deployed LibreChat Container App (e.g., https://ca-dax-acme.<domain>).

.PARAMETER AppDisplayName
    Display name for the app registration.

.PARAMETER KeyVaultName
    Key Vault name. Defaults to derived name matching key-vault.bicep naming.

.PARAMETER SecretExpiryDays
    Client secret validity in days. Defaults to 365.

.EXAMPLE
    ./Deploy-EntraApp.ps1 -ClientName acme `
        -LibreChatUrl "https://ca-dax-acme.niceocean-abcd1234.eastus.azurecontainerapps.io"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $ClientName,
    [Parameter(Mandatory)] [string] $LibreChatUrl,
    [string] $AppDisplayName = "DAX - Dakona AI Workspace",
    [string] $KeyVaultName = "",
    [int]    $SecretExpiryDays = 365
)

$ErrorActionPreference = 'Stop'

# ---------- Derive Key Vault name if not provided ----------
if (-not $KeyVaultName) {
    # Matches key-vault.bicep: replace('kv-dax-${clientName}', '-', ''), truncated to 24 chars
    $kvRaw = ("kv-dax-$ClientName" -replace '-', '')
    if ($kvRaw.Length -gt 24) { $KeyVaultName = $kvRaw.Substring(0, 24) } else { $KeyVaultName = $kvRaw }
}

$redirectUri = "$($LibreChatUrl.TrimEnd('/'))/oauth/openid/callback"

Write-Host "=== DAX Entra ID App Registration ===" -ForegroundColor Cyan
Write-Host "Client:       $ClientName"
Write-Host "App Name:     $AppDisplayName"
Write-Host "Redirect URI: $redirectUri"
Write-Host "Key Vault:    $KeyVaultName"

# ============================================================================
# 1. Create the App Registration
# ============================================================================

Write-Host "`nCreating app registration..." -ForegroundColor Yellow

# Microsoft Graph well-known permission IDs (delegated)
# openid:  37f7f235-527c-4136-accd-4a02d197296e
# profile: 14dad69e-099b-42c9-810b-d002981feec1
# email:   64a6cdd6-aab1-4aaf-94b8-3cc8405e90d0
$graphResourceId = "00000003-0000-0000-c000-000000000000"  # Microsoft Graph

$requiredResourceAccess = @(
    @{
        resourceAppId  = $graphResourceId
        resourceAccess = @(
            @{ id = "37f7f235-527c-4136-accd-4a02d197296e"; type = "Scope" }  # openid
            @{ id = "14dad69e-099b-42c9-810b-d002981feec1"; type = "Scope" }  # profile
            @{ id = "64a6cdd6-aab1-4aaf-94b8-3cc8405e90d0"; type = "Scope" }  # email
        )
    }
)

$jsonPath = [System.IO.Path]::GetTempFileName() + ".json"
$requiredResourceAccess | ConvertTo-Json -Depth 5 | Set-Content $jsonPath

$app = az ad app create `
    --display-name "$AppDisplayName" `
    --sign-in-audience "AzureADMyOrg" `
    --web-redirect-uris "$redirectUri" `
    --enable-id-token-issuance true `
    --required-resource-accesses "@$jsonPath" `
    | ConvertFrom-Json

Remove-Item $jsonPath -Force

$clientId = $app.appId
$objectId = $app.id

Write-Host "  App registered." -ForegroundColor Green
Write-Host "  Client ID (appId): $clientId" -ForegroundColor White
Write-Host "  Object ID:         $objectId" -ForegroundColor DarkGray

# ============================================================================
# 2. Create a Service Principal (required for sign-in)
# ============================================================================

Write-Host "`nCreating service principal..." -ForegroundColor Yellow

az ad sp create --id "$clientId" | Out-Null

Write-Host "  Service principal created." -ForegroundColor Green

# ============================================================================
# 3. Generate a Client Secret
# ============================================================================

Write-Host "`nGenerating client secret ($SecretExpiryDays-day expiry)..." -ForegroundColor Yellow

$endDate = (Get-Date).AddDays($SecretExpiryDays).ToString("yyyy-MM-ddTHH:mm:ssZ")

$secret = az ad app credential reset `
    --id "$objectId" `
    --append `
    --display-name "DAX LibreChat SSO" `
    --end-date "$endDate" `
    --query "password" `
    --output tsv

if (-not $secret) {
    Write-Error "Failed to generate client secret."
    return
}

Write-Host "  Client secret generated." -ForegroundColor Green

# ============================================================================
# 4. Store Client ID and Secret in Key Vault
# ============================================================================

Write-Host "`nStoring credentials in Key Vault ($KeyVaultName)..." -ForegroundColor Yellow

az keyvault secret set `
    --vault-name "$KeyVaultName" `
    --name "entra-client-id" `
    --value "$clientId" `
    --description "Entra ID app client ID for LibreChat SSO" `
    | Out-Null

az keyvault secret set `
    --vault-name "$KeyVaultName" `
    --name "entra-client-secret" `
    --value "$secret" `
    --description "Entra ID app client secret for LibreChat SSO" `
    | Out-Null

Write-Host "  entra-client-id      -> Key Vault" -ForegroundColor Green
Write-Host "  entra-client-secret   -> Key Vault" -ForegroundColor Green

# ============================================================================
# 5. Wire secrets into Container App
# ============================================================================

$rgName = "rg-dax-$ClientName"
$caName = "ca-dax-$ClientName"
$identityName = "id-dax-$ClientName"

Write-Host "`nWiring secrets into Container App ($caName)..." -ForegroundColor Yellow

$kvUri = "https://$KeyVaultName.vault.azure.net/"
$identityId = az identity show -n "$identityName" -g "$rgName" --query "id" -o tsv

az containerapp secret set -n "$caName" -g "$rgName" --secrets `
    "entra-client-id=keyvaultref:${kvUri}secrets/entra-client-id,identityref:${identityId}" `
    "entra-client-secret=keyvaultref:${kvUri}secrets/entra-client-secret,identityref:${identityId}" `
    | Out-Null

az containerapp update -n "$caName" -g "$rgName" --set-env-vars `
    "OPENID_CLIENT_ID=secretref:entra-client-id" `
    "OPENID_CLIENT_SECRET=secretref:entra-client-secret" `
    | Out-Null

Write-Host "  Container App updated with Entra secrets." -ForegroundColor Green

# ============================================================================
# 6. Summary
# ============================================================================

Write-Host "`n=== Entra App Registration Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Client ID:    $clientId"
Write-Host "Key Vault:    $KeyVaultName"
Write-Host "Redirect URI: $redirectUri"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Grant admin consent for the API permissions in the Azure portal:"
Write-Host "     Entra ID > App registrations > $AppDisplayName > API permissions > Grant admin consent"
Write-Host "  2. Run Deploy-SSOConfig.ps1 to set OpenID Connect env vars on the Container App:"
Write-Host "     ./scripts/Deploy-SSOConfig.ps1 -ClientName `"$ClientName`" -ClientTenantId `"<tenant-id>`" -LibreChatUrl `"$($LibreChatUrl.TrimEnd('/'))`""
Write-Host ""
