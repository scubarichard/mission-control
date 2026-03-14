<#
.SYNOPSIS
    Deploys DAX Azure infrastructure into a client subscription.

.PARAMETER ClientName
    Short client identifier matching the params file under clients/<name>/.

.PARAMETER Location
    Azure region. Defaults to eastus.

.EXAMPLE
    ./Deploy-Infrastructure.ps1 -ClientName acme
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $ClientName,
    [string] $Location = "eastus"
)

$ErrorActionPreference = 'Stop'

$paramsFile = "$PSScriptRoot/../clients/$ClientName/params.bicepparam"
if (-not (Test-Path $paramsFile)) {
    Write-Error "Parameter file not found: $paramsFile"
    return
}

Write-Host "=== DAX Infrastructure Deployment ===" -ForegroundColor Cyan
Write-Host "Client:   $ClientName"
Write-Host "Location: $Location"
Write-Host "Params:   $paramsFile"

Write-Host "`nStarting deployment..." -ForegroundColor Yellow

az deployment sub create `
    --location $Location `
    --template-file "$PSScriptRoot/../infra/main.bicep" `
    --parameters $paramsFile `
    --name "dax-infra-$ClientName-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

Write-Host "`nInfrastructure deployment complete." -ForegroundColor Green

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "  1. Deploy-EntraApp.ps1       - Register SSO app"
Write-Host "  2. Deploy-LibreChatSecrets.ps1 - Generate session secrets"
Write-Host "  3. Deploy-SSOConfig.ps1      - Configure OpenID Connect"
Write-Host "  4. Deploy-DocGenApp.ps1      - Register Graph API app"
Write-Host "  5. Deploy-N8n.ps1            - Deploy n8n workflow engine"
Write-Host "  6. Deploy-PurviewPolicies.ps1 - DLP + compliance policies"
