<#
.SYNOPSIS
    Creates an Azure Container Registry, builds the DAX-branded LibreChat
    image, and grants the Container App managed identity pull access.

.DESCRIPTION
    1. Creates ACR (Basic SKU) if it doesn't exist
    2. Builds the Dockerfile via az acr build (no local Docker needed)
    3. Tags as acrdaxdakona.azurecr.io/librechat-dax:latest
    4. Grants AcrPull role to the Container App managed identity

    Run this before Deploy-SSOConfig.ps1 so the custom image is available.

.PARAMETER ClientName
    Short client identifier.

.PARAMETER Location
    Azure region. Defaults to eastus.

.EXAMPLE
    ./Deploy-ContainerRegistry.ps1 -ClientName dakona-pilot
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $ClientName,
    [string] $Location = "eastus"
)

$ErrorActionPreference = 'Stop'

$rgName       = "rg-dax-$ClientName"
$acrName      = "acrdaxdakona"
$imageName    = "librechat-dax"
$imageTag     = "latest"
$fullImage    = "$acrName.azurecr.io/${imageName}:${imageTag}"
$identityName = "id-dax-$ClientName"

Write-Host "=== Deploy Container Registry ===" -ForegroundColor Cyan
Write-Host "Resource Group: $rgName"
Write-Host "ACR Name:       $acrName"
Write-Host "Image:          $fullImage"
Write-Host "Identity:       $identityName"
Write-Host ""

# ============================================================================
# 1. Create ACR if it doesn't exist
# ============================================================================

Write-Host "Checking for existing ACR..." -ForegroundColor Yellow

$acrExists = $false
try {
    az acr show --name "$acrName" --resource-group "$rgName" -o none 2>&1
    if ($LASTEXITCODE -eq 0) { $acrExists = $true }
} catch {
    # ACR doesn't exist
}

if (-not $acrExists) {
    Write-Host "Creating ACR $acrName (Basic SKU)..." -ForegroundColor Yellow
    az acr create `
        --name "$acrName" `
        --resource-group "$rgName" `
        --location "$Location" `
        --sku Basic `
        -o none
    Write-Host "  ACR created." -ForegroundColor Green
} else {
    Write-Host "  ACR $acrName already exists." -ForegroundColor DarkGray
}

# ============================================================================
# 2. Build image via az acr build
# ============================================================================

Write-Host "`nBuilding Docker image via ACR build task..." -ForegroundColor Yellow
Write-Host "  This uploads the Dockerfile context to ACR and builds remotely."
Write-Host "  Image: $fullImage"

$dockerContext = "$PSScriptRoot/.."

az acr build `
    --registry "$acrName" `
    --resource-group "$rgName" `
    --image "${imageName}:${imageTag}" `
    --file "$dockerContext/Dockerfile" `
    "$dockerContext"

if ($LASTEXITCODE -ne 0) {
    Write-Error "ACR build failed."
    return
}

Write-Host "  Image built and pushed to ACR." -ForegroundColor Green

# ============================================================================
# 3. Grant AcrPull role to Container App managed identity
# ============================================================================

Write-Host "`nGranting AcrPull role to managed identity ($identityName)..." -ForegroundColor Yellow

$identityPrincipalId = az identity show `
    -n "$identityName" -g "$rgName" `
    --query "principalId" -o tsv

$acrId = az acr show `
    --name "$acrName" -g "$rgName" `
    --query "id" -o tsv

# Check if role assignment already exists
$existingRole = az role assignment list `
    --assignee "$identityPrincipalId" `
    --scope "$acrId" `
    --role "AcrPull" `
    --query "[0].id" -o tsv

if (-not $existingRole) {
    az role assignment create `
        --assignee-object-id "$identityPrincipalId" `
        --assignee-principal-type ServicePrincipal `
        --role "AcrPull" `
        --scope "$acrId" `
        -o none
    Write-Host "  AcrPull role assigned." -ForegroundColor Green
} else {
    Write-Host "  AcrPull role already assigned." -ForegroundColor DarkGray
}

# ============================================================================
# 4. Summary
# ============================================================================

Write-Host "`n=== Container Registry Ready ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "ACR:      $acrName.azurecr.io"
Write-Host "Image:    $fullImage"
Write-Host "Identity: $identityName (AcrPull)"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Update Container App to use this image:"
Write-Host "     az containerapp update -n ca-dax-$ClientName -g $rgName --image $fullImage"
Write-Host "  2. Or run Deploy-SSOConfig.ps1 which will use this image automatically."
Write-Host ""
