<#
.SYNOPSIS
    Deploys n8n as an Azure Container App in the client's tenant.

.DESCRIPTION
    Creates a Container App running n8n alongside the existing DAX
    LibreChat deployment. Uses the same resource group, VNet, managed
    environment, managed identity, and Key Vault.

    After deployment, imports the document-generator workflow via
    the n8n API.

    Requires: Azure CLI, logged into the client's tenant with
    Contributor access to the DAX resource group.

.PARAMETER ClientName
    Short client identifier (e.g. dakona-pilot).

.PARAMETER ClientTenantId
    Entra tenant ID for the client (used for Graph API auth).

.PARAMETER GraphSiteId
    SharePoint site ID for document uploads.

.PARAMETER KeyVaultName
    Key Vault name. Defaults to derived name matching key-vault.bicep naming.

.EXAMPLE
    ./Deploy-N8n.ps1 -ClientName dakona-pilot `
        -ClientTenantId "d2a3c346-00f3-47dd-a53e-caa3fca74714" `
        -GraphSiteId "dakonallc.sharepoint.com,68764500-f333-44cc-8017-30489a6a9053,71b1b423-6196-4e05-b004-7298445afb6f"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $ClientName,
    [Parameter(Mandatory)] [string] $ClientTenantId,
    [Parameter(Mandatory)] [string] $GraphSiteId,
    [string] $KeyVaultName = ""
)

$ErrorActionPreference = 'Stop'

# ---------- Derive names ----------
$rgName        = "rg-dax-$ClientName"
$caName        = "ca-dax-n8n-$ClientName"
$envName       = "cae-dax-$ClientName"
$identityName  = "id-dax-$ClientName"

if (-not $KeyVaultName) {
    $kvRaw = ("kv-dax-$ClientName" -replace '-', '')
    if ($kvRaw.Length -gt 24) { $KeyVaultName = $kvRaw.Substring(0, 24) } else { $KeyVaultName = $kvRaw }
}

Write-Host "=== DAX n8n Deployment ===" -ForegroundColor Cyan
Write-Host "Client:      $ClientName"
Write-Host "Tenant:      $ClientTenantId"
Write-Host "RG:          $rgName"
Write-Host "Container:   $caName"
Write-Host "Environment: $envName"
Write-Host "Key Vault:   $KeyVaultName"
Write-Host "Site ID:     $GraphSiteId"

# ============================================================================
# 1. Look up existing infrastructure
# ============================================================================

Write-Host "`nLooking up existing DAX infrastructure..." -ForegroundColor Yellow

$kvUri = "https://$KeyVaultName.vault.azure.net/"
$identityId = az identity show -n "$identityName" -g "$rgName" --query "id" -o tsv
$envId = az containerapp env show -n "$envName" -g "$rgName" --query "id" -o tsv

Write-Host "  Managed identity: $identityId" -ForegroundColor DarkGray
Write-Host "  Environment:      $envId" -ForegroundColor DarkGray

# ============================================================================
# 2. Create n8n Container App
# ============================================================================

Write-Host "`nCreating n8n Container App ($caName)..." -ForegroundColor Yellow

az containerapp create `
    --name "$caName" `
    --resource-group "$rgName" `
    --environment "$envName" `
    --image "n8nio/n8n:latest" `
    --target-port 5678 `
    --ingress "internal" `
    --min-replicas 1 `
    --max-replicas 1 `
    --cpu 1.0 `
    --memory 2.0Gi `
    --user-assigned "$identityId" `
    --secrets `
        "docgen-client-id=keyvaultref:${kvUri}secrets/docgen-client-id,identityref:${identityId}" `
        "docgen-client-secret=keyvaultref:${kvUri}secrets/docgen-client-secret,identityref:${identityId}" `
    --env-vars `
        "N8N_PROTOCOL=https" `
        "N8N_HOST=0.0.0.0" `
        "N8N_PORT=5678" `
        "N8N_PUSH_BACKEND=websocket" `
        "N8N_RUNNERS_ENABLED=true" `
        "N8N_BLOCK_ENV_ACCESS_IN_NODE=false" `
        "NODE_FUNCTION_ALLOW_BUILTIN=child_process,fs,path" `
        "NODE_FUNCTION_ALLOW_EXTERNAL=docx" `
        "DB_SQLITE_POOL_SIZE=2" `
        "GRAPH_TENANT_ID=$ClientTenantId" `
        "GRAPH_CLIENT_ID=secretref:docgen-client-id" `
        "GRAPH_CLIENT_SECRET=secretref:docgen-client-secret" `
        "GRAPH_SITE_ID=$GraphSiteId" `
    | Out-Null

Write-Host "  n8n Container App created." -ForegroundColor Green

# ============================================================================
# 3. Get the n8n FQDN and set WEBHOOK_URL
# ============================================================================

Write-Host "`nConfiguring webhook URL..." -ForegroundColor Yellow

$n8nFqdn = az containerapp show `
    -n "$caName" -g "$rgName" `
    --query "properties.configuration.ingress.fqdn" -o tsv

$webhookUrl = "https://$n8nFqdn/"

az containerapp update `
    -n "$caName" -g "$rgName" `
    --set-env-vars "WEBHOOK_URL=$webhookUrl" `
    | Out-Null

Write-Host "  WEBHOOK_URL: $webhookUrl" -ForegroundColor Green

# ============================================================================
# 4. Import workflow via n8n API (inside the container)
# ============================================================================

Write-Host "`nImporting document-generator workflow..." -ForegroundColor Yellow

$workflowFile = "$PSScriptRoot/../n8n/workflows/document-generator.json"
if (-not (Test-Path $workflowFile)) {
    Write-Host "  Workflow file not found: $workflowFile" -ForegroundColor Red
    Write-Host "  Import manually via n8n UI." -ForegroundColor Yellow
} else {
    # Wait for n8n to become healthy
    $maxAttempts = 12
    $ready = $false
    for ($i = 1; $i -le $maxAttempts; $i++) {
        Start-Sleep -Seconds 10
        try {
            $health = az containerapp exec `
                -n "$caName" -g "$rgName" `
                --command "wget -qO- http://localhost:5678/healthz" 2>$null
            if ($health -match "ok") {
                $ready = $true
                break
            }
        } catch { }
        Write-Host "  Attempt $i/$maxAttempts - waiting..." -ForegroundColor DarkGray
    }

    if ($ready) {
        Write-Host "  n8n is running." -ForegroundColor Green

        # Base64-encode the workflow JSON and POST it inside the container
        $workflowJson = Get-Content $workflowFile -Raw
        $workflowB64 = [Convert]::ToBase64String(
            [System.Text.Encoding]::UTF8.GetBytes($workflowJson)
        )

        az containerapp exec `
            -n "$caName" -g "$rgName" `
            --command "sh" -- -c "echo '$workflowB64' | base64 -d | wget -qO- --post-data @- http://localhost:5678/api/v1/workflows --header 'Content-Type: application/json'" `
            2>$null | Out-Null

        Write-Host "  Workflow imported." -ForegroundColor Green
        Write-Host "  NOTE: Activate the workflow in the n8n UI." -ForegroundColor Yellow
    } else {
        Write-Host "  n8n did not start within 2 minutes." -ForegroundColor Red
        Write-Host "  Import the workflow manually via n8n UI:" -ForegroundColor Yellow
        Write-Host "    Workflows > Import from File > n8n/workflows/document-generator.json"
    }
}

# ============================================================================
# 5. Summary
# ============================================================================

Write-Host "`n=== n8n Deployment Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Container App:  $caName"
Write-Host "n8n URL:        $webhookUrl"
Write-Host "Ingress:        Internal only (VNet)"
Write-Host "Environment:    $envName (shared with LibreChat)"
Write-Host "Key Vault:      $KeyVaultName"
Write-Host ""
Write-Host "Environment variables:" -ForegroundColor Yellow
Write-Host "  GRAPH_TENANT_ID       $ClientTenantId"
Write-Host "  GRAPH_CLIENT_ID       (from KV: docgen-client-id)"
Write-Host "  GRAPH_CLIENT_SECRET   (from KV: docgen-client-secret)"
Write-Host "  GRAPH_SITE_ID         $GraphSiteId"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Open n8n UI and activate the document-generator workflow"
Write-Host "  2. Test: POST $($webhookUrl)webhook/generate-document"
Write-Host ""
