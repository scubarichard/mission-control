<#
.SYNOPSIS
    Configures LibreChat OpenID Connect SSO via Container App environment variables.

.DESCRIPTION
    Uses --replace-env-vars to reliably set all environment variables on the
    Container App. This replaces the entire env var set, so the script reads
    existing dynamic values (AZURE_OPENAI_API_INSTANCE_NAME, DOMAIN_CLIENT,
    DOMAIN_SERVER) from the current container template before replacing.

    Requires: Deploy-EntraApp.ps1 must have already run (creates the Key Vault
    secrets entra-client-id and entra-client-secret and wires them as Container
    App secret refs).

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
    [Parameter(Mandatory)] [string] $LibreChatUrl
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
# 1. Read existing env vars we need to preserve
# ============================================================================

Write-Host "`nReading current Container App configuration..." -ForegroundColor Yellow

$currentEnv = az containerapp show -n "$caName" -g "$rgName" `
    --query "properties.template.containers[0].env" -o json | ConvertFrom-Json

# Extract dynamic values set by Bicep at deploy time
$azureInstanceName = ($currentEnv | Where-Object { $_.name -eq 'AZURE_OPENAI_API_INSTANCE_NAME' }).value
$azureApiVersion   = ($currentEnv | Where-Object { $_.name -eq 'AZURE_API_VERSION' }).value
$domainClient      = ($currentEnv | Where-Object { $_.name -eq 'DOMAIN_CLIENT' }).value
$domainServer      = ($currentEnv | Where-Object { $_.name -eq 'DOMAIN_SERVER' }).value

Write-Host "  AZURE_OPENAI_API_INSTANCE_NAME: $azureInstanceName"
Write-Host "  DOMAIN_CLIENT:                  $domainClient"

# ============================================================================
# 2. Replace all env vars (plain-text + secret-backed)
# ============================================================================

Write-Host "`nReplacing env vars on Container App..." -ForegroundColor Yellow

# Build env vars as an array and splat to avoid PowerShell arg-passing issues
# with backtick continuation stripping values from key=value pairs.
$envVars = @(
    "HOST=0.0.0.0"
    "PORT=3080"
    "AZURE_OPENAI_API_INSTANCE_NAME=$azureInstanceName"
    "AZURE_API_VERSION=$azureApiVersion"
    "AZURE_OPENAI_MODELS=gpt-4o"
    "DOMAIN_CLIENT=$domainClient"
    "DOMAIN_SERVER=$domainServer"
    "OPENID_ISSUER=$entraBase/v2.0"
    "OPENID_AUTHORIZATION_URL=$entraBase/oauth2/v2.0/authorize"
    "OPENID_TOKEN_URL=$entraBase/oauth2/v2.0/token"
    "OPENID_USERINFO_URL=https://graph.microsoft.com/oidc/userinfo"
    "OPENID_SCOPE=openid profile email"
    "OPENID_CALLBACK_URL=$callbackUrl"
    "OPENID_BUTTON_LABEL=Login with Microsoft"
    "ALLOW_SOCIAL_LOGIN=true"
    "ALLOW_SOCIAL_REGISTRATION=true"
    "OPENAI_API_KEY=secretref:openai-api-key"
    "MONGO_URI=secretref:cosmos-connection-string"
    "OPENID_CLIENT_ID=secretref:entra-client-id"
    "OPENID_CLIENT_SECRET=secretref:entra-client-secret"
    "JWT_SECRET=secretref:jwt-secret"
    "JWT_REFRESH_SECRET=secretref:jwt-refresh-secret"
    "CREDS_KEY=secretref:creds-key"
    "CREDS_IV=secretref:creds-iv"
)

az containerapp update -n "$caName" -g "$rgName" --replace-env-vars @envVars | Out-Null

Write-Host "  Environment variables replaced ($($envVars.Count) vars)." -ForegroundColor Green

# ============================================================================
# 3. Restart active revision
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
# 4. Summary
# ============================================================================

Write-Host "`n=== SSO Configuration Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "OpenID Connect URLs (tenant: $ClientTenantId):"
Write-Host "  Issuer:         $entraBase/v2.0"
Write-Host "  Authorization:  $entraBase/oauth2/v2.0/authorize"
Write-Host "  Token:          $entraBase/oauth2/v2.0/token"
Write-Host "  UserInfo:       https://graph.microsoft.com/oidc/userinfo"
Write-Host "  Callback:       $callbackUrl"
Write-Host ""
Write-Host "Plain-text env vars:  15"
Write-Host "Secret-backed refs:    8"
Write-Host ""
Write-Host "The 'Login with Microsoft' button should now appear on the login page."
Write-Host ""
