# Add AZURE_SP_* env vars to the MCP Container App
# Run this after New-DakonaScanSP.ps1 and you have the three values

param(
    [Parameter(Mandatory)][string]$SpTenantId,
    [Parameter(Mandatory)][string]$SpClientId,
    [Parameter(Mandatory)][string]$SpClientSecret,
    [string]$ContainerApp = $env:AZURE_CONTAINER_APP,
    [string]$ResourceGroup = $env:AZURE_RG
)

Write-Host "Adding SP env vars to $ContainerApp..." -ForegroundColor Yellow

az containerapp update `
    --name $ContainerApp `
    --resource-group $ResourceGroup `
    --set-env-vars `
        "AZURE_SP_TENANT_ID=$SpTenantId" `
        "AZURE_SP_CLIENT_ID=$SpClientId" `
        "AZURE_SP_CLIENT_SECRET=secretref:azure-sp-client-secret" `
    --output none

# Store the secret in Container Apps secrets (not plain env var)
az containerapp secret set `
    --name $ContainerApp `
    --resource-group $ResourceGroup `
    --secrets "azure-sp-client-secret=$SpClientSecret"

Write-Host "Done. MCP container updated with SP credentials." -ForegroundColor Green
Write-Host "The secret is stored as a Container App secret (not exposed in env)." -ForegroundColor Gray
