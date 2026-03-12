<#
.SYNOPSIS
    Removes temporary Cosmos DB network access granted by Open-CosmosAccess.ps1.

.DESCRIPTION
    Reads the IP saved by Open-CosmosAccess.ps1 from .cosmos-access-ip,
    removes it (and 0.0.0.0) from the Cosmos DB ip-range-filter, then
    deletes the temp file.

.PARAMETER ClientName
    Short client identifier.

.EXAMPLE
    ./Close-CosmosAccess.ps1 -ClientName dakona-pilot
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $ClientName
)

$ErrorActionPreference = 'Stop'

$rgName      = "rg-dax-$ClientName"
$accountName = "cosmos-dax-$ClientName"
$ipFile      = "$PSScriptRoot/../.cosmos-access-ip"

Write-Host "=== Close Cosmos DB Access ===" -ForegroundColor Cyan

if (-not (Test-Path $ipFile)) {
    Write-Error "No active access found (.cosmos-access-ip not found). Did you run Open-CosmosAccess.ps1 first?"
    return
}

$myIp = (Get-Content -Path $ipFile -Raw).Trim()
Write-Host "Removing IP: $myIp"

# Disable public network access
$subId   = (az account show --query id -o tsv)
$token   = (az account get-access-token --query accessToken -o tsv)
$headers = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }
$uri     = "https://management.azure.com/subscriptions/$subId/resourceGroups/$rgName/providers/Microsoft.DocumentDB/databaseAccounts/${accountName}?api-version=2023-04-15"
$body    = '{"properties":{"publicNetworkAccess":"Disabled","ipRules":[]}}'

Invoke-RestMethod -Method PATCH -Uri $uri -Headers $headers -Body $body

# Clean up temp file
Remove-Item -Path $ipFile -Force

Write-Host ""
Write-Host "Access closed — $myIp removed from ip-range-filter" -ForegroundColor Green
