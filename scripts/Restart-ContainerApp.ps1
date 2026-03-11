<#
.SYNOPSIS
    Restarts the LibreChat Container App to pick up configuration changes.

.DESCRIPTION
    Creates a new revision of the Container App, forcing it to reload
    librechat.yaml and environment variables. Use after updating
    librechat.yaml or changing Key Vault secrets.

.PARAMETER ClientName
    Short client identifier.

.EXAMPLE
    ./Restart-ContainerApp.ps1 -ClientName dakona-pilot
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $ClientName
)

$ErrorActionPreference = 'Stop'

$rgName = "rg-dax-$ClientName"
$caName = "ca-dax-$ClientName"

Write-Host "=== DAX Container App Restart ===" -ForegroundColor Cyan
Write-Host "Resource Group: $rgName"
Write-Host "Container App:  $caName"

Write-Host "`nCreating new revision..." -ForegroundColor Yellow

az containerapp revision restart `
    -n "$caName" `
    -g "$rgName" `
    --revision "$(az containerapp revision list -n "$caName" -g "$rgName" --query "[0].name" -o tsv)"

Write-Host "`nContainer App restarted." -ForegroundColor Green
Write-Host "It may take a minute for the new revision to become active."
