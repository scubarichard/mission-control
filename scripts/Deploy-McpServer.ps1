<#
.SYNOPSIS
    Deploys the DAX MCP server as an Azure Container App with SSE transport.

.DESCRIPTION
    Creates a Container App running the MCP server in SSE mode for claude.ai
    remote MCP connections. Uses the same resource group, VNet, managed
    environment, managed identity, and Key Vault as the existing DAX deployment.

    1. Builds the MCP server Docker image via ACR
    2. Grants AcrPull to the managed identity (if not already granted)
    3. Creates or updates the Container App
    4. Configures custom domain (mcp.dakona.net) if DNS is ready
    5. Verifies /health endpoint

    Requires: Azure CLI, logged in with Contributor access to the DAX resource group.

.PARAMETER ClientName
    Short client identifier (e.g. dakona-pilot).

.PARAMETER CustomDomain
    Custom domain for the MCP server. Defaults to mcp.dakona.net.

.PARAMETER Location
    Azure region. Defaults to eastus.

.EXAMPLE
    ./Deploy-McpServer.ps1 -ClientName dakona-pilot
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $ClientName,
    [string] $CustomDomain = "mcp.dakona.net",
    [string] $Location = "eastus"
)

$ErrorActionPreference = 'Stop'

# ---------- Derive names ----------
$rgName        = "rg-dax-$ClientName"
$caName        = "ca-dax-mcp-$ClientName"
$envName       = "cae-dax-$ClientName"
$identityName  = "id-dax-$ClientName"
$acrName       = "acrdaxdakona"
$imageName     = "mcp-server"
$imageTag      = (Get-Date -Format "yyyyMMdd-HHmmss")
$fullImage     = "$acrName.azurecr.io/${imageName}:${imageTag}"
$latestImage   = "$acrName.azurecr.io/${imageName}:latest"

Write-Host "=== DAX MCP Server Deployment ===" -ForegroundColor Cyan
Write-Host "Client:        $ClientName"
Write-Host "RG:            $rgName"
Write-Host "Container App: $caName"
Write-Host "Environment:   $envName"
Write-Host "ACR Image:     $fullImage"
Write-Host "Custom Domain: $CustomDomain"
Write-Host ""

# ============================================================================
# 1. Look up existing infrastructure
# ============================================================================

Write-Host "Looking up existing DAX infrastructure..." -ForegroundColor Yellow

$identityId = az identity show -n "$identityName" -g "$rgName" --query "id" -o tsv
$identityPrincipalId = az identity show -n "$identityName" -g "$rgName" --query "principalId" -o tsv
$envId = az containerapp env show -n "$envName" -g "$rgName" --query "id" -o tsv

Write-Host "  Managed identity: $identityId" -ForegroundColor DarkGray
Write-Host "  Environment:      $envId" -ForegroundColor DarkGray

# ============================================================================
# 2. Build Docker image via ACR
# ============================================================================

Write-Host "`nBuilding MCP server image via ACR..." -ForegroundColor Yellow

$dockerContext = "$PSScriptRoot/../mcp"

az acr build `
    --registry "$acrName" `
    --resource-group "$rgName" `
    --image "${imageName}:${imageTag}" `
    --image "${imageName}:latest" `
    --file "$dockerContext/Dockerfile" `
    "$dockerContext"

if ($LASTEXITCODE -ne 0) {
    Write-Error "ACR build failed."
    return
}

Write-Host "  Image built: $fullImage" -ForegroundColor Green

# ============================================================================
# 3. Ensure AcrPull role is granted
# ============================================================================

Write-Host "`nChecking AcrPull role..." -ForegroundColor Yellow

$acrId = az acr show --name "$acrName" -g "$rgName" --query "id" -o tsv

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
    Write-Host "  AcrPull already assigned." -ForegroundColor DarkGray
}

# ============================================================================
# 4. Create or update MCP Container App
# ============================================================================

Write-Host "`nDeploying MCP Container App ($caName)..." -ForegroundColor Yellow

$caExists = $false
try {
    az containerapp show -n "$caName" -g "$rgName" -o none 2>&1
    if ($LASTEXITCODE -eq 0) { $caExists = $true }
} catch { }

if ($caExists) {
    Write-Host "  Container App exists, updating image..." -ForegroundColor DarkGray
    az containerapp update `
        -n "$caName" `
        -g "$rgName" `
        --image "$latestImage" `
        | Out-Null
    Write-Host "  Image updated." -ForegroundColor Green
} else {
    az containerapp create `
        --name "$caName" `
        --resource-group "$rgName" `
        --environment "$envName" `
        --image "$latestImage" `
        --registry-server "$acrName.azurecr.io" `
        --registry-identity "$identityId" `
        --target-port 3001 `
        --ingress "external" `
        --min-replicas 1 `
        --max-replicas 3 `
        --cpu 0.5 `
        --memory 1.0Gi `
        --user-assigned "$identityId" `
        --env-vars `
            "MCP_TRANSPORT=sse" `
            "PORT=3001" `
            "DAX_REPO_PATH=/app" `
            "AZURE_SUBSCRIPTION=36676e89-8ccf-4390-8602-e57a913755dc" `
            "AZURE_RG=$rgName" `
            "AZURE_CONTAINER_APP=ca-dax-$ClientName" `
            "N8N_URL=https://n8n.dakona.net" `
        | Out-Null

    Write-Host "  Container App created." -ForegroundColor Green
}

# ============================================================================
# 5. Get the FQDN
# ============================================================================

$mcpFqdn = az containerapp show `
    -n "$caName" -g "$rgName" `
    --query "properties.configuration.ingress.fqdn" -o tsv

$mcpUrl = "https://$mcpFqdn"

Write-Host "`n  MCP URL: $mcpUrl" -ForegroundColor Green

# ============================================================================
# 6. Configure custom domain (if DNS is ready)
# ============================================================================

if ($CustomDomain) {
    Write-Host "`nConfiguring custom domain ($CustomDomain)..." -ForegroundColor Yellow

    # Check if custom domain is already configured
    $existingDomains = az containerapp hostname list `
        -n "$caName" -g "$rgName" `
        --query "[?name=='$CustomDomain'].name" -o tsv

    if ($existingDomains) {
        Write-Host "  Custom domain already configured." -ForegroundColor DarkGray
    } else {
        # Check DNS resolution
        $dnsCheck = $null
        try {
            $dnsCheck = Resolve-DnsName -Name $CustomDomain -Type CNAME -ErrorAction SilentlyContinue
        } catch { }

        if ($dnsCheck) {
            Write-Host "  DNS resolves. Adding custom domain..." -ForegroundColor DarkGray
            try {
                az containerapp hostname add `
                    -n "$caName" -g "$rgName" `
                    --hostname "$CustomDomain" `
                    -o none

                # Bind managed certificate
                az containerapp hostname bind `
                    -n "$caName" -g "$rgName" `
                    --hostname "$CustomDomain" `
                    --environment "$envName" `
                    --validation-method CNAME `
                    -o none

                Write-Host "  Custom domain + managed TLS configured." -ForegroundColor Green
            } catch {
                Write-Host "  Custom domain binding failed: $_" -ForegroundColor Red
                Write-Host "  Configure manually or ensure DNS CNAME points to: $mcpFqdn" -ForegroundColor Yellow
            }
        } else {
            Write-Host "  DNS not yet configured for $CustomDomain" -ForegroundColor Yellow
            Write-Host "  Create a CNAME record:" -ForegroundColor Yellow
            Write-Host "    $CustomDomain  CNAME  $mcpFqdn" -ForegroundColor White
            Write-Host "  Then re-run this script to bind the domain." -ForegroundColor Yellow
        }
    }
}

# ============================================================================
# 7. Wait for health check
# ============================================================================

Write-Host "`nWaiting for MCP server to become healthy..." -ForegroundColor Yellow

$maxAttempts = 12
$healthy = $false

for ($i = 1; $i -le $maxAttempts; $i++) {
    Start-Sleep -Seconds 10
    try {
        $health = Invoke-RestMethod -Uri "$mcpUrl/health" -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($health.status -eq "ok") {
            $healthy = $true
            break
        }
    } catch { }
    Write-Host "  Attempt $i/$maxAttempts - waiting..." -ForegroundColor DarkGray
}

if ($healthy) {
    Write-Host "  MCP server is healthy!" -ForegroundColor Green
} else {
    Write-Host "  Server did not report healthy within 2 minutes." -ForegroundColor Red
    Write-Host "  Check logs: az containerapp logs show -n $caName -g $rgName --type console --tail 50" -ForegroundColor Yellow
}

# ============================================================================
# 8. Summary
# ============================================================================

Write-Host "`n=== MCP Server Deployment Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Container App:   $caName"
Write-Host "Default URL:     $mcpUrl"
Write-Host "Health check:    $mcpUrl/health"
Write-Host "SSE endpoint:    $mcpUrl/sse"
Write-Host "Messages:        $mcpUrl/messages"
Write-Host "Environment:     $envName (shared with LibreChat)"
Write-Host "Image:           $fullImage"
Write-Host "Min replicas:    1 (always warm)"
Write-Host ""
if ($CustomDomain) {
    Write-Host "Custom domain:   https://$CustomDomain" -ForegroundColor Yellow
    Write-Host "  CNAME target:  $mcpFqdn"
}
Write-Host ""
Write-Host "To add to claude.ai:" -ForegroundColor Yellow
Write-Host "  1. Go to claude.ai > Settings > Integrations > MCP"
Write-Host "  2. Add server URL: $mcpUrl/sse"
if ($CustomDomain) {
    Write-Host "     Or: https://$CustomDomain/sse (after DNS is configured)"
}
Write-Host ""
