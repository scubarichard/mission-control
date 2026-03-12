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

# Get current ip-range-filter
$current = az cosmosdb show `
    --name "$accountName" `
    --resource-group "$rgName" `
    --query ipRules -o json | ConvertFrom-Json

$existingIps = @($current | ForEach-Object { $_.ipAddressOrRange }) | Where-Object { $_ }

# Remove caller IP and 0.0.0.0
$newIps = @($existingIps) | Where-Object { $_ -ne $myIp -and $_ -ne '0.0.0.0' }

$ipRangeFilter = ($newIps -join ',')

az cosmosdb update `
    --name "$accountName" `
    --resource-group "$rgName" `
    --ip-range-filter "$ipRangeFilter" `
    -o none

# Clean up temp file
Remove-Item -Path $ipFile -Force

Write-Host ""
Write-Host "Access closed — $myIp removed from ip-range-filter" -ForegroundColor Green
