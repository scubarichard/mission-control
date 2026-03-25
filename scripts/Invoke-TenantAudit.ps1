<#
.SYNOPSIS
    Dakona CSP Tenant Audit - scans all customer tenants for health, license usage,
    Azure anomalies, and service incidents.

.DESCRIPTION
    Authenticates via service principal, enumerates all CSP customers via
    Microsoft Graph managedTenants API (M365 Lighthouse), then per-tenant:
    - License bought vs consumed
    - Service health / active incidents
    - Azure subscription health + resource anomalies
    - Cost/spend summary

.ENVIRONMENT VARS REQUIRED
    AZURE_SP_TENANT_ID    - Dakona tenant ID
    AZURE_SP_CLIENT_ID    - Scanner SP client ID
    AZURE_SP_CLIENT_SECRET - Scanner SP secret

.OUTPUT
    JSON report + console table summary
#>

param(
    [string]$TenantId     = $env:AZURE_SP_TENANT_ID,
    [string]$ClientId     = $env:AZURE_SP_CLIENT_ID,
    [string]$ClientSecret = $env:AZURE_SP_CLIENT_SECRET,
    [string]$OutputPath   = "/tmp/dakona-tenant-audit-$(Get-Date -Format 'yyyyMMdd-HHmm').json",
    [switch]$ConsoleOnly
)

$ErrorActionPreference = "Stop"

#region --- Auth helpers ---

function Get-GraphToken {
    param([string]$Scope = "https://graph.microsoft.com/.default")
    $body = @{
        grant_type    = "client_credentials"
        client_id     = $ClientId
        client_secret = $ClientSecret
        scope         = $Scope
    }
    $r = Invoke-RestMethod -Method POST `
        -Uri "https://login.microsoftonline.com/$TenantId/oauth2/v2.0/token" `
        -Body $body -ContentType "application/x-www-form-urlencoded"
    return $r.access_token
}

function Get-ArmToken {
    return Get-GraphToken -Scope "https://management.azure.com/.default"
}

function Invoke-Graph {
    param([string]$Uri, [string]$Token, [string]$Method = "GET")
    $headers = @{ Authorization = "Bearer $Token"; "Content-Type" = "application/json" }
    $results = @()
    $nextUri = $Uri
    do {
        $resp = Invoke-RestMethod -Method $Method -Uri $nextUri -Headers $headers
        if ($resp.value) { $results += $resp.value }
        else { $results += $resp }
        $nextUri = $resp.'@odata.nextLink'
    } while ($nextUri)
    return $results
}

function Invoke-Arm {
    param([string]$Uri, [string]$Token)
    $headers = @{ Authorization = "Bearer $Token" }
    try {
        $resp = Invoke-RestMethod -Method GET -Uri $Uri -Headers $headers
        return $resp.value ?? $resp
    } catch { return $null }
}

#endregion

#region --- Data collection per tenant ---

function Get-TenantLicenses {
    param([string]$CustomerTenantId, [string]$Token)
    try {
        # Use Graph with x-ms-delegated-tenant header for CSP/Lighthouse access
        $headers = @{
            Authorization         = "Bearer $Token"
            "x-ms-delegatedtenantid" = $CustomerTenantId
        }
        $resp = Invoke-RestMethod -Method GET `
            -Uri "https://graph.microsoft.com/v1.0/subscribedSkus" `
            -Headers $headers
        
        $licenses = @()
        foreach ($sku in $resp.value) {
            $licenses += [PSCustomObject]@{
                SkuName     = $sku.skuPartNumber
                Purchased   = $sku.prepaidUnits.enabled
                Assigned    = $sku.consumedUnits
                Unused      = $sku.prepaidUnits.enabled - $sku.consumedUnits
                UsedPct     = if ($sku.prepaidUnits.enabled -gt 0) { 
                                  [math]::Round(($sku.consumedUnits / $sku.prepaidUnits.enabled) * 100, 1) 
                              } else { 0 }
            }
        }
        return $licenses
    } catch {
        return @([PSCustomObject]@{ Error = $_.Exception.Message })
    }
}

function Get-ServiceHealth {
    param([string]$CustomerTenantId, [string]$Token)
    try {
        $headers = @{
            Authorization            = "Bearer $Token"
            "x-ms-delegatedtenantid" = $CustomerTenantId
        }
        $issues = Invoke-RestMethod -Method GET `
            -Uri "https://graph.microsoft.com/v1.0/admin/serviceAnnouncement/issues?`$filter=isResolved eq false" `
            -Headers $headers
        
        return $issues.value | Select-Object id, title, service, status, severity, startDateTime
    } catch {
        return @([PSCustomObject]@{ Error = $_.Exception.Message })
    }
}

function Get-AzureSubscriptions {
    param([string]$CustomerTenantId, [string]$ArmToken)
    try {
        # Lighthouse-delegated ARM call
        $subs = Invoke-RestMethod -Method GET `
            -Uri "https://management.azure.com/subscriptions?api-version=2022-12-01" `
            -Headers @{ Authorization = "Bearer $ArmToken" }
        
        # Filter to this customer's tenant
        $customerSubs = $subs.value | Where-Object { $_.tenantId -eq $CustomerTenantId }
        
        $results = @()
        foreach ($sub in $customerSubs) {
            $subData = [PSCustomObject]@{
                SubscriptionId   = $sub.subscriptionId
                Name             = $sub.displayName
                State            = $sub.state
                AdvisorAlerts    = 0
                CostCurrentMonth = "N/A"
                ResourceCount    = 0
            }
            
            # Resource count
            try {
                $resources = Invoke-RestMethod -Method POST `
                    -Uri "https://management.azure.com/subscriptions/$($sub.subscriptionId)/providers/Microsoft.ResourceGraph/resources?api-version=2022-10-01" `
                    -Headers @{ Authorization = "Bearer $ArmToken"; "Content-Type" = "application/json" } `
                    -Body '{"query":"Resources | count"}' 
                $subData.ResourceCount = $resources.data.rows[0][0]
            } catch {}
            
            # Advisor recommendations (anomalies/issues)
            try {
                $advisorUri = "https://management.azure.com/subscriptions/$($sub.subscriptionId)/providers/Microsoft.Advisor/recommendations?api-version=2023-01-01&`$filter=Category eq 'HighAvailability' or Category eq 'Security'"
                $advisor = Invoke-RestMethod -Method GET -Uri $advisorUri `
                    -Headers @{ Authorization = "Bearer $ArmToken" }
                $subData.AdvisorAlerts = ($advisor.value).Count
            } catch {}
            
            # Cost current month
            try {
                $now = Get-Date
                $firstOfMonth = (Get-Date -Day 1 -Hour 0 -Minute 0 -Second 0).ToString("yyyy-MM-dd")
                $today = $now.ToString("yyyy-MM-dd")
                $costBody = @{
                    type       = "Usage"
                    timeframe  = "Custom"
                    timePeriod = @{ from = $firstOfMonth; to = $today }
                    dataset    = @{
                        granularity = "None"
                        aggregation = @{ totalCost = @{ name = "Cost"; function = "Sum" } }
                    }
                } | ConvertTo-Json -Depth 5
                
                $cost = Invoke-RestMethod -Method POST `
                    -Uri "https://management.azure.com/subscriptions/$($sub.subscriptionId)/providers/Microsoft.CostManagement/query?api-version=2023-11-01" `
                    -Headers @{ Authorization = "Bearer $ArmToken"; "Content-Type" = "application/json" } `
                    -Body $costBody
                
                $costVal = $cost.properties.rows[0][0]
                $currency = $cost.properties.columns | Where-Object { $_.name -eq "Currency" } | Select-Object -ExpandProperty name
                $subData.CostCurrentMonth = "`$$([math]::Round($costVal, 2))"
            } catch {}
            
            $results += $subData
        }
        return $results
    } catch {
        return @([PSCustomObject]@{ Error = $_.Exception.Message })
    }
}

#endregion

#region --- Main ---

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host " Dakona CSP Tenant Audit" -ForegroundColor Cyan
Write-Host " $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') UTC" -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan

# Validate env vars
if (-not $TenantId -or -not $ClientId -or -not $ClientSecret) {
    Write-Host "ERROR: Missing env vars. Set AZURE_SP_TENANT_ID, AZURE_SP_CLIENT_ID, AZURE_SP_CLIENT_SECRET" -ForegroundColor Red
    exit 1
}

# Get tokens
Write-Host "Authenticating..." -ForegroundColor Yellow
$graphToken = Get-GraphToken
$armToken   = Get-ArmToken
Write-Host "Auth OK.`n" -ForegroundColor Green

# Enumerate tenants via M365 Lighthouse / managedTenants
Write-Host "Enumerating CSP customer tenants..." -ForegroundColor Yellow
$tenants = @()

try {
    # M365 Lighthouse managed tenants (requires ManagedTenants.Read.All)
    $lighthouseTenants = Invoke-Graph `
        -Uri "https://graph.microsoft.com/beta/tenantRelationships/managedTenants/tenants?`$select=tenantId,displayName,tenantStatusInformation" `
        -Token $graphToken
    
    foreach ($t in $lighthouseTenants) {
        $tenants += [PSCustomObject]@{
            TenantId    = $t.tenantId
            DisplayName = $t.displayName
            Source      = "Lighthouse"
        }
    }
    Write-Host "  Found $($tenants.Count) tenants via M365 Lighthouse" -ForegroundColor Gray
} catch {
    Write-Host "  Lighthouse API unavailable ($($_.Exception.Message)). Trying Graph contracts..." -ForegroundColor Yellow
}

# Fallback: Graph contracts endpoint
if ($tenants.Count -eq 0) {
    try {
        $contracts = Invoke-Graph `
            -Uri "https://graph.microsoft.com/v1.0/contracts?`$select=customerId,displayName,defaultDomainName" `
            -Token $graphToken
        
        foreach ($c in $contracts) {
            $tenants += [PSCustomObject]@{
                TenantId    = $c.customerId
                DisplayName = $c.displayName
                Domain      = $c.defaultDomainName
                Source      = "Graph/Contracts"
            }
        }
        Write-Host "  Found $($tenants.Count) tenants via Graph contracts" -ForegroundColor Gray
    } catch {
        Write-Host "  Graph contracts API failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

if ($tenants.Count -eq 0) {
    Write-Host "`nNo tenants found. Check SP permissions and Partner Center enrollment." -ForegroundColor Red
    exit 1
}

Write-Host "Scanning $($tenants.Count) tenants...`n" -ForegroundColor Green

# Per-tenant scan
$report = @()
$i = 0
foreach ($tenant in $tenants) {
    $i++
    Write-Host "[$i/$($tenants.Count)] $($tenant.DisplayName) ($($tenant.TenantId))" -ForegroundColor White
    
    $tenantReport = [PSCustomObject]@{
        TenantId         = $tenant.TenantId
        DisplayName      = $tenant.DisplayName
        ScannedAt        = (Get-Date -Format "o")
        Licenses         = @()
        ServiceIncidents = @()
        AzureSubscriptions = @()
        Flags            = @()
    }
    
    # Licenses
    Write-Host "  - Licenses..." -ForegroundColor Gray
    $tenantReport.Licenses = Get-TenantLicenses -CustomerTenantId $tenant.TenantId -Token $graphToken
    
    # Flag unused licenses > 20%
    foreach ($lic in $tenantReport.Licenses) {
        if ($lic.Unused -gt 0 -and $lic.UsedPct -lt 80 -and $lic.Purchased -ge 5) {
            $tenantReport.Flags += "⚠ $($lic.SkuName): $($lic.Unused) unused ($($lic.UsedPct)% used)"
        }
    }
    
    # Service health
    Write-Host "  - Service health..." -ForegroundColor Gray
    $tenantReport.ServiceIncidents = Get-ServiceHealth -CustomerTenantId $tenant.TenantId -Token $graphToken
    foreach ($inc in $tenantReport.ServiceIncidents) {
        if ($inc.severity -in @("high","critical")) {
            $tenantReport.Flags += "🔴 Incident: $($inc.service) - $($inc.title)"
        }
    }
    
    # Azure subscriptions
    Write-Host "  - Azure subscriptions..." -ForegroundColor Gray
    $tenantReport.AzureSubscriptions = Get-AzureSubscriptions -CustomerTenantId $tenant.TenantId -ArmToken $armToken
    foreach ($sub in $tenantReport.AzureSubscriptions) {
        if ($sub.AdvisorAlerts -gt 5) {
            $tenantReport.Flags += "⚠ Azure sub '$($sub.Name)': $($sub.AdvisorAlerts) advisor alerts"
        }
        if ($sub.State -ne "Enabled" -and $sub.State) {
            $tenantReport.Flags += "🔴 Azure sub '$($sub.Name)' state: $($sub.State)"
        }
    }
    
    $report += $tenantReport
    
    # Quick summary line
    $licCount = ($tenantReport.Licenses | Where-Object { -not $_.Error }).Count
    $incCount = ($tenantReport.ServiceIncidents | Where-Object { -not $_.Error }).Count
    $flagStr  = if ($tenantReport.Flags.Count -gt 0) { " [$($tenantReport.Flags.Count) flags]" } else { " [clean]" }
    Write-Host "     $licCount SKUs | $incCount incidents$flagStr" -ForegroundColor Gray
}

# --- Console Summary ---
Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host " AUDIT SUMMARY" -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan

foreach ($t in $report) {
    $flagCount = $t.Flags.Count
    $color = if ($flagCount -eq 0) { "Green" } elseif ($flagCount -le 2) { "Yellow" } else { "Red" }
    
    Write-Host "$($t.DisplayName)" -ForegroundColor $color
    
    # License table
    $goodLics = $t.Licenses | Where-Object { -not $_.Error }
    if ($goodLics.Count -gt 0) {
        $totalBought    = ($goodLics | Measure-Object Purchased -Sum).Sum
        $totalAssigned  = ($goodLics | Measure-Object Assigned -Sum).Sum
        $totalUnused    = $totalBought - $totalAssigned
        Write-Host "  Licenses: $totalAssigned/$totalBought assigned ($totalUnused unused across $($goodLics.Count) SKUs)"
    }
    
    # Incidents
    $activeInc = $t.ServiceIncidents | Where-Object { -not $_.Error }
    if ($activeInc.Count -gt 0) {
        Write-Host "  Service incidents: $($activeInc.Count) active"
    }
    
    # Azure
    $goodSubs = $t.AzureSubscriptions | Where-Object { -not $_.Error }
    if ($goodSubs.Count -gt 0) {
        $totalAdvisor = ($goodSubs | Measure-Object AdvisorAlerts -Sum).Sum
        Write-Host "  Azure: $($goodSubs.Count) sub(s), $totalAdvisor advisor alerts"
    }
    
    # Flags
    foreach ($flag in $t.Flags) {
        Write-Host "  $flag" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Save JSON report
if (-not $ConsoleOnly) {
    $report | ConvertTo-Json -Depth 10 | Set-Content $OutputPath -Encoding UTF8
    Write-Host "Report saved to: $OutputPath" -ForegroundColor Green
}

Write-Host "`nDone. Scanned $($report.Count) tenants." -ForegroundColor Cyan
return $report
