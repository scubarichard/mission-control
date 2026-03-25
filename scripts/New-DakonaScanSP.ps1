<#
.SYNOPSIS
    Creates a Dakona CSP Tenant Scanner service principal with all permissions
    needed to audit customer tenants via Partner Center, Graph, and ARM APIs.

.DESCRIPTION
    Run this ONCE from a Global Admin account in the Dakona tenant.
    Outputs CLIENT_ID, CLIENT_SECRET, TENANT_ID to paste into the MCP container env vars.

.NOTES
    Requires: az CLI logged in as Global Admin in Dakona tenant
    After running, also add the SP to the "Admin Agents" group in Partner Center:
    https://partner.microsoft.com/dashboard/account/aadapps
#>

param(
    [string]$AppName = "dakona-csp-scanner",
    [int]$SecretYears = 2
)

$ErrorActionPreference = "Stop"
Write-Host "`n=== Dakona CSP Scanner - Service Principal Setup ===" -ForegroundColor Cyan

# Verify logged in
$account = az account show --output json | ConvertFrom-Json
Write-Host "Logged in as: $($account.user.name)" -ForegroundColor Green
Write-Host "Tenant: $($account.tenantId)"
$TenantId = $account.tenantId

# Check for existing app
Write-Host "`nChecking for existing app '$AppName'..." -ForegroundColor Yellow
$existingApp = az ad app list --display-name $AppName --output json | ConvertFrom-Json
if ($existingApp.Count -gt 0) {
    Write-Host "App already exists (ID: $($existingApp[0].appId)). Delete it first or change AppName." -ForegroundColor Red
    exit 1
}

# Create the app registration
Write-Host "Creating app registration..." -ForegroundColor Yellow
$app = az ad app create `
    --display-name $AppName `
    --sign-in-audience "AzureADMyOrg" `
    --output json | ConvertFrom-Json

$ClientId = $app.appId
$ObjectId = $app.id
Write-Host "App created: $ClientId" -ForegroundColor Green

# Create service principal
Write-Host "Creating service principal..." -ForegroundColor Yellow
az ad sp create --id $ClientId | Out-Null

# Generate client secret
Write-Host "Generating client secret ($SecretYears year expiry)..." -ForegroundColor Yellow
$secretResult = az ad app credential reset `
    --id $ClientId `
    --years $SecretYears `
    --output json | ConvertFrom-Json
$ClientSecret = $secretResult.password

# --- API Permissions ---
Write-Host "`nAdding API permissions..." -ForegroundColor Yellow

# Microsoft Graph permissions
$GraphAppId = "00000003-0000-0000-c000-000000000000"
$graphPermissions = @(
    "Directory.Read.All",           # Read tenant/user/license info
    "Reports.Read.All",             # M365 usage reports
    "ServiceHealth.Read.All",       # Service health per tenant
    "Organization.Read.All"         # Org-level info
)

foreach ($perm in $graphPermissions) {
    $permId = (az ad sp show --id $GraphAppId --output json | ConvertFrom-Json).appRoles | 
              Where-Object { $_.value -eq $perm } | Select-Object -ExpandProperty id
    if ($permId) {
        az ad app permission add `
            --id $ClientId `
            --api $GraphAppId `
            --api-permissions "$permId=Role" 2>&1 | Out-Null
        Write-Host "  + Graph: $perm" -ForegroundColor Gray
    }
}

# Partner Center API
$PartnerCenterAppId = "fa3d9a0c-3fb0-42cc-9193-45c81479d5c0"
$pcPerm = az ad sp show --id $PartnerCenterAppId --output json 2>$null | ConvertFrom-Json
if ($pcPerm) {
    $pcPermId = $pcPerm.appRoles | Where-Object { $_.value -eq "user_impersonation" } | Select-Object -ExpandProperty id
    if ($pcPermId) {
        az ad app permission add `
            --id $ClientId `
            --api $PartnerCenterAppId `
            --api-permissions "$pcPermId=Scope" 2>&1 | Out-Null
        Write-Host "  + Partner Center: user_impersonation" -ForegroundColor Gray
    }
} else {
    Write-Host "  ! Partner Center API not found - may need manual consent in Partner Center portal" -ForegroundColor Yellow
}

# Grant admin consent
Write-Host "`nGranting admin consent..." -ForegroundColor Yellow
Start-Sleep -Seconds 10  # Wait for SP replication
az ad app permission admin-consent --id $ClientId 2>&1 | Out-Null
Write-Host "Admin consent granted." -ForegroundColor Green

# Assign Reader role at subscription level for ARM access
Write-Host "`nAssigning Reader role on subscription..." -ForegroundColor Yellow
$SpObjectId = (az ad sp show --id $ClientId --output json | ConvertFrom-Json).id
az role assignment create `
    --assignee $SpObjectId `
    --role "Reader" `
    --scope "/subscriptions/$($account.id)" 2>&1 | Out-Null
Write-Host "Reader role assigned on subscription $($account.id)." -ForegroundColor Green

# --- Output ---
Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "SUCCESS! Add these env vars to the MCP container:" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "AZURE_SP_TENANT_ID=$TenantId"
Write-Host "AZURE_SP_CLIENT_ID=$ClientId"
Write-Host "AZURE_SP_CLIENT_SECRET=$ClientSecret"
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. Copy the env vars above into the MCP container" -ForegroundColor White
Write-Host "2. Add SP to 'Admin Agents' group in Partner Center:" -ForegroundColor White
Write-Host "   https://partner.microsoft.com/dashboard/account/aadapps" -ForegroundColor White
Write-Host "   Search for: $AppName" -ForegroundColor White
Write-Host "3. Run: scripts/Invoke-TenantAudit.ps1 to test" -ForegroundColor White
Write-Host ""
Write-Host "Save the secret securely - it won't be shown again!" -ForegroundColor Red
