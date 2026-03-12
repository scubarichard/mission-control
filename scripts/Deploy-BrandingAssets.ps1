<#
.SYNOPSIS
    Deploys DAX branding assets to Azure Blob Storage.

.DESCRIPTION
    Creates a storage account with a public blob container and uploads
    the Dakona logo and DAX robot avatar so they can be referenced by
    librechat.yaml and external pages.

.PARAMETER ClientName
    Short client identifier.

.PARAMETER Location
    Azure region. Defaults to eastus.

.EXAMPLE
    ./Deploy-BrandingAssets.ps1 -ClientName dakona-pilot
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $ClientName,
    [string] $Location = "eastus"
)

$ErrorActionPreference = 'Stop'

$rgName         = "rg-dax-$ClientName"
$storageAccount = "stdaxassets"
$containerName  = "branding"
$assetsDir      = "$PSScriptRoot/../docs"

$files = @(
    "Dakona_Logo_-_Wordmark.png",
    "lexi_avatar_384.png"
)

Write-Host "=== Deploy Branding Assets ===" -ForegroundColor Cyan
Write-Host "Resource Group:  $rgName"
Write-Host "Storage Account: $storageAccount"
Write-Host "Container:       $containerName"
Write-Host ""

# 1. Create storage account if it doesn't exist
$storageExists = $false
try {
    $existing = az storage account show --name "$storageAccount" --resource-group "$rgName" -o json 2>&1
    if ($LASTEXITCODE -eq 0) { $storageExists = $true }
} catch {
    # Account doesn't exist - will create below
}

if (-not $storageExists) {
    Write-Host "Creating storage account $storageAccount..." -ForegroundColor Yellow
    az storage account create `
        --name "$storageAccount" `
        --resource-group "$rgName" `
        --location "$Location" `
        --sku Standard_LRS `
        --kind StorageV2 `
        --allow-blob-public-access true `
        -o none
    Write-Host "  Created." -ForegroundColor Green
} else {
    Write-Host "Storage account $storageAccount already exists." -ForegroundColor DarkGray
}

# 2. Get storage account key
$accountKey = az storage account keys list `
    --account-name "$storageAccount" `
    --resource-group "$rgName" `
    --query "[0].value" -o tsv

# 3. Create blob container with public read access
$containerExists = $false
try {
    $containerCheck = az storage container show `
        --name "$containerName" `
        --account-name "$storageAccount" `
        --account-key "$accountKey" `
        -o json 2>&1
    if ($LASTEXITCODE -eq 0) { $containerExists = $true }
} catch {
    # Container doesn't exist - will create below
}

if (-not $containerExists) {
    Write-Host "Creating blob container $containerName..." -ForegroundColor Yellow
    az storage container create `
        --name "$containerName" `
        --account-name "$storageAccount" `
        --account-key "$accountKey" `
        --public-access blob `
        -o none
    Write-Host "  Created with public blob access." -ForegroundColor Green
} else {
    Write-Host "Blob container $containerName already exists." -ForegroundColor DarkGray
}

# 4. Upload files
Write-Host ""
Write-Host "Uploading branding assets..." -ForegroundColor Yellow

foreach ($file in $files) {
    $filePath = Join-Path $assetsDir $file
    if (-not (Test-Path $filePath)) {
        Write-Host "  SKIP (not found): $file" -ForegroundColor Red
        continue
    }

    az storage blob upload `
        --file "$filePath" `
        --container-name "$containerName" `
        --name "$file" `
        --account-name "$storageAccount" `
        --account-key "$accountKey" `
        --overwrite `
        -o none

    Write-Host "  Uploaded: $file" -ForegroundColor Green
}

# 5. Output public URLs
Write-Host ""
Write-Host "=== Public URLs ===" -ForegroundColor Cyan
foreach ($file in $files) {
    $url = "https://${storageAccount}.blob.core.windows.net/${containerName}/${file}"
    Write-Host "  $url"
}
Write-Host ""
Write-Host "Use these URLs in librechat.yaml for customLogoUrl and other branding." -ForegroundColor Green
