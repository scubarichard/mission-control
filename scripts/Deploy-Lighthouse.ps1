<#
.SYNOPSIS
    Deploys Azure Lighthouse delegation into a client subscription.

.DESCRIPTION
    Registers the Dakona managing tenant with the client subscription
    so Dakona operators can manage DAX resources cross-tenant.

.PARAMETER ClientName
    Short client identifier (e.g., "acme").

.PARAMETER ClientSubscriptionId
    The client's Azure subscription ID to delegate.

.PARAMETER DakonaTenantId
    Dakona's Entra ID tenant ID.

.PARAMETER DakonaPrincipalId
    Object ID of the Dakona security group or user to authorize.

.EXAMPLE
    ./Deploy-Lighthouse.ps1 -ClientName acme `
        -ClientSubscriptionId "00000000-..." `
        -DakonaTenantId "11111111-..." `
        -DakonaPrincipalId "22222222-..."
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $ClientName,
    [Parameter(Mandatory)] [string] $ClientSubscriptionId,
    [Parameter(Mandatory)] [string] $DakonaTenantId,
    [Parameter(Mandatory)] [string] $DakonaPrincipalId
)

$ErrorActionPreference = 'Stop'

Write-Host "=== DAX Lighthouse Deployment ===" -ForegroundColor Cyan
Write-Host "Client:       $ClientName"
Write-Host "Subscription: $ClientSubscriptionId"
Write-Host "Managing tenant: $DakonaTenantId"

# Set context to client subscription
az account set --subscription $ClientSubscriptionId

# Built-in role IDs
$contributorRole = "b24988ac-6180-42a0-ab88-20f7382dd24c"
$readerRole = "acdd72a7-3385-48ef-bd42-f606fba81ae7"

$authorizations = @(
    @{
        principalId          = $DakonaPrincipalId
        roleDefinitionId     = $contributorRole
        principalIdDisplayName = "Dakona DAX Operators"
    },
    @{
        principalId          = $DakonaPrincipalId
        roleDefinitionId     = $readerRole
        principalIdDisplayName = "Dakona DAX Operators (Reader)"
    }
) | ConvertTo-Json -Compress

Write-Host "`nDeploying Lighthouse registration..." -ForegroundColor Yellow

az deployment sub create `
    --location eastus `
    --template-file "$PSScriptRoot/../infra/modules/lighthouse.bicep" `
    --parameters `
        managingTenantId=$DakonaTenantId `
        authorizations=$authorizations `
    --name "dax-lighthouse-$ClientName"

Write-Host "`nLighthouse delegation complete." -ForegroundColor Green
