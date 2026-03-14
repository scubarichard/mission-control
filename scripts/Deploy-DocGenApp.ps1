<#
.SYNOPSIS
    Registers an Entra ID application for DAX document generation via Microsoft Graph.

.DESCRIPTION
    Creates an app registration in the client tenant with:
    - Application permissions: Sites.ReadWrite.All, Files.ReadWrite.All (Microsoft Graph)
    - Client credentials flow (no user interaction required)
    - A client secret (stored in Key Vault)
    - Admin consent granted automatically

    This app is used by n8n workflows to generate and upload documents
    to SharePoint via the Microsoft Graph API.

    Requires: Azure CLI with permissions to create app registrations
    and grant admin consent in the target tenant.

.PARAMETER ClientName
    Short client identifier (matches Key Vault naming: kv-dax-<clientName>).

.PARAMETER AppDisplayName
    Display name for the app registration.

.PARAMETER KeyVaultName
    Key Vault name. Defaults to derived name matching key-vault.bicep naming.

.PARAMETER SecretExpiryDays
    Client secret validity in days. Defaults to 365.

.EXAMPLE
    ./Deploy-DocGenApp.ps1 -ClientName dakona-pilot
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $ClientName,
    [string] $AppDisplayName = "DAX Document Generator",
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

Write-Host "=== DAX Document Generator - Entra App Registration ===" -ForegroundColor Cyan
Write-Host "Client:    $ClientName"
Write-Host "App Name:  $AppDisplayName"
Write-Host "Key Vault: $KeyVaultName"

# ============================================================================
# 1. Create the App Registration
# ============================================================================

Write-Host "`nCreating app registration..." -ForegroundColor Yellow

# Microsoft Graph application permission IDs (type = Role for app-only)
# Sites.ReadWrite.All:  9492366f-7969-46a4-8d15-ed1a20078fff
# Files.ReadWrite.All:  75359482-378d-4052-8f01-80520e7db3cd
$graphResourceId = "00000003-0000-0000-c000-000000000000"  # Microsoft Graph

$requiredResourceAccess = @(
    @{
        resourceAppId  = $graphResourceId
        resourceAccess = @(
            @{ id = "9492366f-7969-46a4-8d15-ed1a20078fff"; type = "Role" }  # Sites.ReadWrite.All
            @{ id = "75359482-378d-4052-8f01-80520e7db3cd"; type = "Role" }  # Files.ReadWrite.All
        )
    }
)

$jsonPath = [System.IO.Path]::GetTempFileName() + ".json"
$requiredResourceAccess | ConvertTo-Json -Depth 5 | Set-Content $jsonPath

# No redirect URIs - client credentials flow (app-only, no user sign-in)
$app = az ad app create `
    --display-name "$AppDisplayName" `
    --sign-in-audience "AzureADMyOrg" `
    --required-resource-accesses "@$jsonPath" `
    | ConvertFrom-Json

Remove-Item $jsonPath -Force

$clientId = $app.appId
$objectId = $app.id

Write-Host "  App registered." -ForegroundColor Green
Write-Host "  Client ID (appId): $clientId" -ForegroundColor White
Write-Host "  Object ID:         $objectId" -ForegroundColor DarkGray

# ============================================================================
# 2. Create a Service Principal (required for consent and token acquisition)
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
    --display-name "DAX Document Generator" `
    --end-date "$endDate" `
    --query "password" `
    --output tsv

if (-not $secret) {
    Write-Error "Failed to generate client secret."
    return
}

Write-Host "  Client secret generated." -ForegroundColor Green

# ============================================================================
# 4. Grant Admin Consent for Application Permissions
# ============================================================================

Write-Host "`nGranting admin consent for application permissions..." -ForegroundColor Yellow

# Small delay to allow replication of the service principal
Start-Sleep -Seconds 5

az ad app permission admin-consent --id "$clientId"

Write-Host "  Admin consent granted for Sites.ReadWrite.All, Files.ReadWrite.All." -ForegroundColor Green

# ============================================================================
# 5. Store Client ID and Secret in Key Vault
# ============================================================================

Write-Host "`nStoring credentials in Key Vault ($KeyVaultName)..." -ForegroundColor Yellow

az keyvault secret set `
    --vault-name "$KeyVaultName" `
    --name "docgen-client-id" `
    --value "$clientId" `
    --description "Entra ID app client ID for DAX Document Generator (Graph API)" `
    | Out-Null

az keyvault secret set `
    --vault-name "$KeyVaultName" `
    --name "docgen-client-secret" `
    --value "$secret" `
    --description "Entra ID app client secret for DAX Document Generator (Graph API)" `
    | Out-Null

Write-Host "  docgen-client-id      -> Key Vault" -ForegroundColor Green
Write-Host "  docgen-client-secret  -> Key Vault" -ForegroundColor Green

# ============================================================================
# 6. Summary
# ============================================================================

Write-Host "`n=== Document Generator App Registration Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Client ID:     $clientId"
Write-Host "Key Vault:     $KeyVaultName"
Write-Host "Permissions:   Sites.ReadWrite.All, Files.ReadWrite.All (Application)"
Write-Host "Auth flow:     Client credentials (app-only, no user sign-in)"
Write-Host ""
Write-Host "Key Vault secrets:" -ForegroundColor Yellow
Write-Host "  docgen-client-id      App registration client ID"
Write-Host "  docgen-client-secret  Client secret (expires in $SecretExpiryDays days)"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Verify admin consent in Azure Portal:"
Write-Host "     Entra ID > App registrations > $AppDisplayName > API permissions"
Write-Host "     All permissions should show 'Granted for <tenant>'"
Write-Host "  2. Configure n8n environment variables:"
Write-Host "     GRAPH_TENANT_ID  = <your tenant ID>"
Write-Host "     GRAPH_CLIENT_ID  = (from Key Vault: docgen-client-id)"
Write-Host "     GRAPH_CLIENT_SECRET = (from Key Vault: docgen-client-secret)"
Write-Host "     GRAPH_SITE_ID    = (SharePoint site ID - see docs/graph-document-generation.md)"
Write-Host "  3. Import the document-generator workflow into n8n"
Write-Host ""
