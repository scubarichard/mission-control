<#
.SYNOPSIS
    Configures LibreChat OpenID Connect SSO and injects librechat.yaml config
    via Container App environment variables and an init container.

.DESCRIPTION
    1. Base64-encodes librechat/librechat.yaml from the repo
    2. Reads the current Container App JSON to preserve Bicep-set values
    3. Exports a modified container template JSON with:
       - Init container: decodes CONFIG_YAML_B64 -> /config/librechat.yaml
       - Main container: all env vars (plain-text + secret-backed)
       - Shared EmptyDir volume for config file handoff
    4. Applies the template via az containerapp update --yaml
    5. Restarts the active revision

    Requires: Deploy-EntraApp.ps1 and Deploy-LibreChatSecrets.ps1 must have
    already run (creates Key Vault secrets and Container App secret refs).

.PARAMETER ClientName
    Short client identifier.

.PARAMETER ClientTenantId
    Entra ID tenant ID for the client. Used to construct OpenID Connect URLs.

.PARAMETER LibreChatUrl
    The FQDN of the deployed LibreChat Container App (e.g., https://ca-dax-acme.<domain>).

.EXAMPLE
    ./Deploy-SSOConfig.ps1 -ClientName dakona-pilot `
        -ClientTenantId "d2a3c346-00f3-47dd-a53e-caa3fca74714" `
        -LibreChatUrl "https://ca-dax-dakona-pilot.icyplant-88ae76cd.eastus.azurecontainerapps.io"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $ClientName,
    [Parameter(Mandatory)] [string] $ClientTenantId,
    [Parameter(Mandatory)] [string] $LibreChatUrl,
    [string] $OpenAIInstanceName = "oai-dax-$ClientName"
)

$ErrorActionPreference = 'Stop'

$rgName = "rg-dax-$ClientName"
$caName = "ca-dax-$ClientName"
$callbackUrl = "$($LibreChatUrl.TrimEnd('/'))/oauth/openid/callback"
$entraBase = "https://login.microsoftonline.com/$ClientTenantId"

Write-Host "=== DAX SSO Configuration ===" -ForegroundColor Cyan
Write-Host "Client:        $ClientName"
Write-Host "Tenant ID:     $ClientTenantId"
Write-Host "Container App: $caName"
Write-Host "Callback URL:  $callbackUrl"

# ============================================================================
# 1. Base64-encode librechat.yaml
# ============================================================================

$yamlPath = "$PSScriptRoot/../librechat/librechat.yaml"
if (-not (Test-Path $yamlPath)) {
    Write-Error "librechat.yaml not found: $yamlPath"
    return
}

Write-Host "`nEncoding librechat.yaml as base64..." -ForegroundColor Yellow

$yamlBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $yamlPath).Path)
$yamlBase64 = [System.Convert]::ToBase64String($yamlBytes)

Write-Host "  Encoded $($yamlBytes.Length) bytes -> $($yamlBase64.Length) chars base64"

# ============================================================================
# 2. Read current Container App config and resolve env var values
# ============================================================================

Write-Host "`nReading current Container App configuration..." -ForegroundColor Yellow

$currentApp = az containerapp show -n "$caName" -g "$rgName" -o json | ConvertFrom-Json

# Use parameter values directly (not container state, which may be corrupted)
$azureInstanceName = $OpenAIInstanceName
$azureApiVersion   = "2024-08-01-preview"
$domainClient      = $LibreChatUrl.TrimEnd('/')
$domainServer      = $LibreChatUrl.TrimEnd('/')

Write-Host "  AZURE_OPENAI_API_INSTANCE_NAME: $azureInstanceName"
Write-Host "  DOMAIN_CLIENT:                  $domainClient"

# Derive Key Vault name (matches key-vault.bicep: strip hyphens, cap at 24)
$kvRaw = ("kv-dax-$ClientName" -replace '-', '')
if ($kvRaw.Length -gt 24) { $kvName = $kvRaw.Substring(0, 24) } else { $kvName = $kvRaw }

Write-Host "`nReading secrets from Key Vault ($kvName)..." -ForegroundColor Yellow

$entraClientId = az keyvault secret show --vault-name "$kvName" --name "entra-client-id" --query "value" -o tsv
$entraClientSecret = az keyvault secret show --vault-name "$kvName" --name "entra-client-secret" --query "value" -o tsv
$sessionSecret = az keyvault secret show --vault-name "$kvName" --name "jwt-secret" --query "value" -o tsv

if (-not $entraClientId -or -not $entraClientSecret) {
    Write-Error "Failed to read Entra credentials from Key Vault. Run Deploy-EntraApp.ps1 first."
    return
}
if (-not $sessionSecret) {
    Write-Error "Failed to read jwt-secret from Key Vault. Run Deploy-LibreChatSecrets.ps1 first."
    return
}

Write-Host "  entra-client-id:         $($entraClientId.Substring(0,8))..."
Write-Host "  entra-client-secret:     ********"
Write-Host "  openid-session-secret:   (from jwt-secret) ********"

# ============================================================================
# 3. Build updated container template
# ============================================================================

Write-Host "`nBuilding updated container template..." -ForegroundColor Yellow

# Preserve existing container image, resource settings, and configuration
$currentContainer = $currentApp.properties.template.containers[0]
$containerImage = $currentContainer.image
$containerCpu = $currentContainer.resources.cpu
$containerMemory = $currentContainer.resources.memory
$currentConfig = $currentApp.properties.configuration

$template = @{
    properties = @{
        configuration = @{
            ingress = $currentConfig.ingress
            secrets = @($currentConfig.secrets | ForEach-Object {
                # Preserve each secret's KV ref and identity binding
                $secret = @{ name = $_.name }
                if ($_.keyVaultUrl) { $secret.keyVaultUrl = $_.keyVaultUrl }
                if ($_.identity)    { $secret.identity = $_.identity }
                $secret
            })
        }
        template = @{
            volumes = @(
                @{
                    name = 'config-vol'
                    storageType = 'EmptyDir'
                }
            )
            initContainers = @(
                @{
                    name = 'write-config'
                    image = 'mcr.microsoft.com/cbl-mariner/base/core:2.0'
                    command = @( '/bin/sh', '-c', 'echo "$CONFIG_YAML_B64" | base64 -d > /config/librechat.yaml' )
                    env = @(
                        @{ name = 'CONFIG_YAML_B64'; value = $yamlBase64 }
                    )
                    resources = @{
                        cpu = 0.25
                        memory = '0.5Gi'
                    }
                    volumeMounts = @(
                        @{ volumeName = 'config-vol'; mountPath = '/config' }
                    )
                }
            )
            containers = @(
                @{
                    name = 'librechat'
                    image = $containerImage
                    resources = @{
                        cpu = $containerCpu
                        memory = $containerMemory
                    }
                    volumeMounts = @(
                        @{ volumeName = 'config-vol'; mountPath = '/config' }
                    )
                    env = @(
                        @{ name = 'HOST'; value = '0.0.0.0' }
                        @{ name = 'PORT'; value = '3080' }
                        @{ name = 'CONFIG_PATH'; value = '/config/librechat.yaml' }
                        @{ name = 'AZURE_OPENAI_API_INSTANCE_NAME'; value = $azureInstanceName }
                        @{ name = 'AZURE_API_VERSION'; value = $azureApiVersion }
                        @{ name = 'AZURE_OPENAI_MODELS'; value = 'gpt-4o' }
                        @{ name = 'DOMAIN_CLIENT'; value = $domainClient }
                        @{ name = 'DOMAIN_SERVER'; value = $domainServer }
                        @{ name = 'OPENID_ISSUER'; value = "$entraBase/v2.0" }
                        @{ name = 'OPENID_AUTHORIZATION_URL'; value = "$entraBase/oauth2/v2.0/authorize" }
                        @{ name = 'OPENID_TOKEN_URL'; value = "$entraBase/oauth2/v2.0/token" }
                        @{ name = 'OPENID_USERINFO_URL'; value = 'https://graph.microsoft.com/oidc/userinfo' }
                        @{ name = 'OPENID_SCOPE'; value = 'openid profile email' }
                        @{ name = 'OPENID_CALLBACK_URL'; value = $callbackUrl }
                        @{ name = 'OPENID_BUTTON_LABEL'; value = 'Login with Microsoft' }
                        @{ name = 'ALLOW_SOCIAL_LOGIN'; value = 'true' }
                        @{ name = 'ALLOW_SOCIAL_REGISTRATION'; value = 'true' }
                        # Entra credentials + session secret resolved from Key Vault at deploy time
                        @{ name = 'OPENID_CLIENT_ID'; value = $entraClientId }
                        @{ name = 'OPENID_CLIENT_SECRET'; value = $entraClientSecret }
                        @{ name = 'OPENID_SESSION_SECRET'; value = $sessionSecret }
                        # Secret-backed env vars (refs to Container App secrets from Key Vault)
                        @{ name = 'OPENAI_API_KEY'; secretRef = 'openai-api-key' }
                        @{ name = 'MONGO_URI'; secretRef = 'cosmos-connection-string' }
                        @{ name = 'JWT_SECRET'; secretRef = 'jwt-secret' }
                        @{ name = 'JWT_REFRESH_SECRET'; secretRef = 'jwt-refresh-secret' }
                        @{ name = 'CREDS_KEY'; secretRef = 'creds-key' }
                        @{ name = 'CREDS_IV'; secretRef = 'creds-iv' }
                    )
                }
            )
        }
    }
}

# ============================================================================
# 4. Apply template via ARM REST API (PATCH)
# ============================================================================
# Using az rest instead of az containerapp update --yaml because:
# - --yaml expects YAML format with full resource definition, not a JSON fragment
# - az rest accepts native JSON and handles camelCase field names correctly
# - Secret refs (secretRef) are preserved without casing issues

Write-Host "`nApplying container template update via ARM API..." -ForegroundColor Yellow

$subscriptionId = az account show --query "id" -o tsv
$resourceUrl = "/subscriptions/$subscriptionId/resourceGroups/$rgName/providers/Microsoft.App/containerApps/${caName}?api-version=2024-03-01"

$jsonPath = [System.IO.Path]::GetTempFileName() + ".json"
$template | ConvertTo-Json -Depth 15 | Set-Content $jsonPath -Encoding UTF8

az rest --method PATCH --url "$resourceUrl" --body "@$jsonPath" | Out-Null
Remove-Item $jsonPath -Force

Write-Host "  Template updated (init container + main container + shared volume)." -ForegroundColor Green

# ============================================================================
# 5. Restart active revision
# ============================================================================

Write-Host "`nRestarting active revision..." -ForegroundColor Yellow

$activeRevision = az containerapp revision list `
    -n "$caName" -g "$rgName" `
    --query "[?properties.active].name | [0]" -o tsv

az containerapp revision restart `
    -n "$caName" -g "$rgName" `
    --revision "$activeRevision"

Write-Host "  Revision restarted." -ForegroundColor Green

# ============================================================================
# 6. Summary
# ============================================================================

Write-Host "`n=== SSO Configuration Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Config:  librechat.yaml injected via init container ($($yamlBytes.Length) bytes)"
Write-Host "Path:    /config/librechat.yaml (CONFIG_PATH)"
Write-Host ""
Write-Host "OpenID Connect URLs (tenant: $ClientTenantId):"
Write-Host "  Issuer:         $entraBase/v2.0"
Write-Host "  Authorization:  $entraBase/oauth2/v2.0/authorize"
Write-Host "  Token:          $entraBase/oauth2/v2.0/token"
Write-Host "  UserInfo:       https://graph.microsoft.com/oidc/userinfo"
Write-Host "  Callback:       $callbackUrl"
Write-Host ""
Write-Host "Plain-text env vars:  17 (main) + 1 (init)"
Write-Host "Secret-backed refs:    8"
Write-Host ""
Write-Host "The 'Login with Microsoft' button should now appear on the login page."
Write-Host ""
