<#
.SYNOPSIS
    Temporarily opens Cosmos DB network access for the caller's public IP.

.DESCRIPTION
    Adds the caller's public IP (and 0.0.0.0 for Azure portal access) to the
    Cosmos DB account ip-range-filter. Saves the IP to .cosmos-access-ip so
    Close-CosmosAccess.ps1 can remove it later.

.PARAMETER ClientName
    Short client identifier.

.EXAMPLE
    ./Open-CosmosAccess.ps1 -ClientName dakona-pilot
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $ClientName
)

$ErrorActionPreference = 'Stop'

$rgName      = "rg-dax-$ClientName"
$accountName = "cosmos-dax-$ClientName"
$ipFile      = "$PSScriptRoot/../.cosmos-access-ip"

Write-Host "=== Open Cosmos DB Access ===" -ForegroundColor Cyan

# Get caller's public IP
$myIp = (Invoke-RestMethod -Uri 'https://api.ipify.org' -UseBasicParsing).Trim()
Write-Host "Your public IP: $myIp"

# Enable public network access and allow caller IP + portal
az cosmosdb update `
    --name "$accountName" `
    --resource-group "$rgName" `
    --enable-public-network true `
    --ip-range-filter "$myIp,0.0.0.0" `
    -o none

# Save IP so Close script knows what to remove
$myIp | Out-File -FilePath $ipFile -Encoding utf8 -NoNewline

Write-Host ""
Write-Host "Access opened for $myIp" -ForegroundColor Green
Write-Host "Run Close-CosmosAccess.ps1 when done to lock it back down."
