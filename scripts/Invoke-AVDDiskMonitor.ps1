<#
.SYNOPSIS
    Dakona AVD Disk Capacity Monitor - scans C: drive usage on AVD session hosts
    across all CSP customer tenants and creates NinjaOne tickets when usage >= 80%.

.DESCRIPTION
    Authenticates via service principal (same SP as Invoke-TenantAudit.ps1),
    enumerates all CSP customers via Microsoft Graph managedTenants API,
    then per-tenant:
    - Lists AVD session hosts (Microsoft.DesktopVirtualization/hostpools/sessionhosts)
    - For each session host VM, queries Log Analytics for latest
      'LogicalDisk(C:)\% Free Space' counter
    - If C: usage >= threshold (default 80%), opens a NinjaOne ticket with
      client name, hostname, % used, free GB, host pool, resource group.

.ENVIRONMENT VARS REQUIRED
    AZURE_SP_TENANT_ID          - Dakona tenant ID
    AZURE_SP_CLIENT_ID          - Scanner SP client ID
    AZURE_SP_CLIENT_SECRET      - Scanner SP secret

    NINJA_INSTANCE              - 'app' (US, default), 'eu', 'oc', or 'ca'
    NINJA_CLIENT_ID             - NinjaOne API client ID (Monitoring scope minimum;
                                  Management scope required for ticket creation)
    NINJA_CLIENT_SECRET         - NinjaOne API client secret
    NINJA_BOARD_ID              - (optional) NinjaOne ticketing board ID; omit to
                                  use the default board on the instance

.PARAMETER ThresholdPercent
    Disk used % at or above which a ticket is opened. Default 80.

.PARAMETER DryRun
    Skip ticket creation; print what would be ticketed.

.PARAMETER OutputPath
    JSON report path. Default /tmp/dakona-avd-disk-{timestamp}.json.

.OUTPUT
    JSON report + console summary. Tickets in NinjaOne when threshold exceeded.

.NOTES
    De-duplication: ticket subject includes hostname + UTC date so a re-run
    within the same UTC day will not create a duplicate ticket — the script
    queries NinjaOne for an open ticket with the same subject before creating.

    Schedule via cron / Azure Automation / Task Scheduler. Recommended cadence:
    every 4 hours during business hours.
#>

[CmdletBinding()]
param(
    [string]$TenantId         = $env:AZURE_SP_TENANT_ID,
    [string]$ClientId         = $env:AZURE_SP_CLIENT_ID,
    [string]$ClientSecret     = $env:AZURE_SP_CLIENT_SECRET,

    [string]$NinjaInstance    = $(if ($env:NINJA_INSTANCE) { $env:NINJA_INSTANCE } else { 'app' }),
    [string]$NinjaClientId    = $env:NINJA_CLIENT_ID,
    [string]$NinjaClientSecret= $env:NINJA_CLIENT_SECRET,
    [int]   $NinjaBoardId     = $(if ($env:NINJA_BOARD_ID) { [int]$env:NINJA_BOARD_ID } else { 0 }),

    [int]   $ThresholdPercent = 80,
    [switch]$DryRun,
    [string]$OutputPath       = "/tmp/dakona-avd-disk-$(Get-Date -Format 'yyyyMMdd-HHmm').json"
)

$ErrorActionPreference = "Stop"

#region --- Auth helpers (mirror Invoke-TenantAudit.ps1 pattern) ---

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

function Get-ArmToken { return Get-GraphToken -Scope "https://management.azure.com/.default" }
function Get-LaToken  { return Get-GraphToken -Scope "https://api.loganalytics.io/.default" }

function Invoke-Graph {
    param([string]$Uri, [string]$Token)
    $headers = @{ Authorization = "Bearer $Token"; "Content-Type" = "application/json" }
    $results = @(); $next = $Uri
    do {
        $resp = Invoke-RestMethod -Method GET -Uri $next -Headers $headers
        if ($resp.value) { $results += $resp.value } else { $results += $resp }
        $next = $resp.'@odata.nextLink'
    } while ($next)
    return $results
}

#endregion

#region --- NinjaOne helpers ---

function Get-NinjaToken {
    $base = switch ($NinjaInstance) {
        'eu' { 'https://eu.ninjarmm.com' }
        'oc' { 'https://oc.ninjarmm.com' }
        'ca' { 'https://ca.ninjarmm.com' }
        default { 'https://app.ninjarmm.com' }
    }
    $body = @{
        grant_type    = 'client_credentials'
        client_id     = $NinjaClientId
        client_secret = $NinjaClientSecret
        scope         = 'monitoring management'
    }
    $r = Invoke-RestMethod -Method POST `
        -Uri "$base/ws/oauth/token" `
        -Body $body -ContentType 'application/x-www-form-urlencoded'
    return @{ Token = $r.access_token; Base = $base }
}

function Test-NinjaDuplicateTicket {
    param([string]$Subject, [hashtable]$Ninja)
    # Search open tickets for matching subject (today's run, same hostname).
    try {
        $headers = @{ Authorization = "Bearer $($Ninja.Token)" }
        # NinjaOne ticketing API: GET /v2/ticketing/trigger/board/{boardId}/run with filter.
        # Simpler: GET /v2/ticketing/ticket?searchCriteria=...&pageSize=25&status=OPEN
        $encoded = [uri]::EscapeDataString($Subject)
        $uri = "$($Ninja.Base)/v2/ticketing/ticket?searchCriteria=$encoded&pageSize=10"
        $resp = Invoke-RestMethod -Method GET -Uri $uri -Headers $headers
        $matches = @($resp | Where-Object { $_.subject -eq $Subject -and $_.status.statusId -ne 5000 })  # 5000 = Resolved/Closed
        return ($matches.Count -gt 0)
    } catch {
        Write-Host "    [ninja] dup check failed: $($_.Exception.Message)" -ForegroundColor DarkYellow
        return $false  # err on side of creating ticket
    }
}

function New-NinjaTicket {
    param(
        [string]$Subject,
        [string]$Body,
        [string]$Priority,        # LOW | NORMAL | HIGH | CRITICAL
        [hashtable]$Ninja
    )
    $headers = @{
        Authorization  = "Bearer $($Ninja.Token)"
        'Content-Type' = 'application/json'
    }
    $payload = @{
        subject     = $Subject
        description = @{
            public = $true
            body   = $Body
            htmlBody = $false
        }
        priority    = $Priority
        status      = 'NEW'
        type        = 'PROBLEM'
    }
    if ($NinjaBoardId -gt 0) { $payload.ticketFormId = $NinjaBoardId }

    $json = $payload | ConvertTo-Json -Depth 6
    $resp = Invoke-RestMethod -Method POST `
        -Uri "$($Ninja.Base)/v2/ticketing/ticket" `
        -Headers $headers -Body $json
    return $resp
}

#endregion

#region --- Azure / Log Analytics helpers ---

function Get-CustomerTenants {
    param([string]$Token)
    $tenants = @()
    try {
        $list = Invoke-Graph `
            -Uri "https://graph.microsoft.com/beta/tenantRelationships/managedTenants/tenants?`$select=tenantId,displayName" `
            -Token $Token
        foreach ($t in $list) {
            $tenants += [PSCustomObject]@{ TenantId = $t.tenantId; DisplayName = $t.displayName }
        }
    } catch {
        Write-Host "  Lighthouse unavailable, falling back to /contracts" -ForegroundColor Yellow
        $list = Invoke-Graph `
            -Uri "https://graph.microsoft.com/v1.0/contracts?`$select=customerId,displayName" `
            -Token $Token
        foreach ($c in $list) {
            $tenants += [PSCustomObject]@{ TenantId = $c.customerId; DisplayName = $c.displayName }
        }
    }
    return $tenants
}

function Get-TenantSubscriptions {
    param([string]$CustomerTenantId, [string]$ArmToken)
    try {
        $subs = Invoke-RestMethod -Method GET `
            -Uri "https://management.azure.com/subscriptions?api-version=2022-12-01" `
            -Headers @{ Authorization = "Bearer $ArmToken" }
        return $subs.value | Where-Object { $_.tenantId -eq $CustomerTenantId -and $_.state -eq 'Enabled' }
    } catch { return @() }
}

function Get-AVDSessionHosts {
    <#
        Returns a list of session host objects for a subscription, with VM resource ID
        resolved so we can query Log Analytics by _ResourceId.
    #>
    param([string]$SubscriptionId, [string]$ArmToken)

    $headers = @{ Authorization = "Bearer $ArmToken" }
    $hosts = @()

    # 1. Find all host pools in the subscription
    $hpUri = "https://management.azure.com/subscriptions/$SubscriptionId/providers/Microsoft.DesktopVirtualization/hostPools?api-version=2024-04-03"
    try {
        $hpResp = Invoke-RestMethod -Method GET -Uri $hpUri -Headers $headers
    } catch { return @() }

    foreach ($hp in $hpResp.value) {
        $hpId = $hp.id    # /subscriptions/.../resourceGroups/X/providers/Microsoft.DesktopVirtualization/hostPools/Y
        # 2. List session hosts in this host pool
        $shUri = "https://management.azure.com$hpId/sessionHosts?api-version=2024-04-03"
        try {
            $shResp = Invoke-RestMethod -Method GET -Uri $shUri -Headers $headers
        } catch { continue }

        foreach ($sh in $shResp.value) {
            # sh.properties.resourceId points at the VM
            $vmResourceId = $sh.properties.resourceId
            if (-not $vmResourceId) { continue }

            # parse hostname from sh.name (format: hostpool/HOSTNAME.domain.local)
            $hostname = ($sh.name -split '/')[-1]

            $hosts += [PSCustomObject]@{
                HostPool       = $hp.name
                ResourceGroup  = ($hpId -split '/')[4]
                SubscriptionId = $SubscriptionId
                Hostname       = $hostname
                VMResourceId   = $vmResourceId
                Status         = $sh.properties.status
                AllowNewSession= $sh.properties.allowNewSession
            }
        }
    }
    return $hosts
}

function Get-WorkspaceForVM {
    <#
        Find the Log Analytics workspace ID a VM is sending data to via DCR or
        legacy MMA. Returns workspace customerId (GUID) or $null.
    #>
    param([string]$VMResourceId, [string]$ArmToken)

    $headers = @{ Authorization = "Bearer $ArmToken" }

    # Strategy: list Data Collection Rule Associations on the VM, then read each DCR
    # for its destination workspace. Falls back to legacy MicrosoftMonitoringAgent
    # extension if no DCR is present.
    try {
        $dcraUri = "https://management.azure.com$VMResourceId/providers/Microsoft.Insights/dataCollectionRuleAssociations?api-version=2022-06-01"
        $dcra = Invoke-RestMethod -Method GET -Uri $dcraUri -Headers $headers
        foreach ($assoc in $dcra.value) {
            $dcrId = $assoc.properties.dataCollectionRuleId
            if (-not $dcrId) { continue }
            $dcr = Invoke-RestMethod -Method GET -Uri "https://management.azure.com$($dcrId)?api-version=2022-06-01" -Headers $headers
            $wsId = $dcr.properties.destinations.logAnalytics[0].workspaceResourceId
            if ($wsId) {
                $ws = Invoke-RestMethod -Method GET -Uri "https://management.azure.com$($wsId)?api-version=2022-10-01" -Headers $headers
                return $ws.properties.customerId
            }
        }
    } catch {}

    # Legacy MMA fallback
    try {
        $extUri = "https://management.azure.com$VMResourceId/extensions/MicrosoftMonitoringAgent?api-version=2023-09-01"
        $ext = Invoke-RestMethod -Method GET -Uri $extUri -Headers $headers
        return $ext.properties.settings.workspaceId
    } catch {}

    return $null
}

function Get-DiskUsageFromLA {
    <#
        Query Log Analytics for the latest C:\ disk free % counter for a VM.
        Returns @{ UsedPct; FreeGB; SizeGB } or $null if no data.
    #>
    param(
        [string]$WorkspaceCustomerId,
        [string]$Hostname,
        [string]$LaToken
    )

    if (-not $WorkspaceCustomerId) { return $null }

    # KQL pulls the most recent free space % and free MB for C: from Perf,
    # then derives total size. 30-min lookback covers the standard 60s sample rate.
    $kql = @"
Perf
| where TimeGenerated > ago(30m)
| where Computer startswith "$Hostname"
| where ObjectName == "LogicalDisk" and InstanceName == "C:"
| where CounterName in ("% Free Space", "Free Megabytes")
| summarize arg_max(TimeGenerated, *) by CounterName
| project CounterName, CounterValue
"@

    $body = @{ query = $kql } | ConvertTo-Json
    $headers = @{
        Authorization  = "Bearer $LaToken"
        'Content-Type' = 'application/json'
    }
    try {
        $resp = Invoke-RestMethod -Method POST `
            -Uri "https://api.loganalytics.io/v1/workspaces/$WorkspaceCustomerId/query" `
            -Headers $headers -Body $body
    } catch { return $null }

    $rows = $resp.tables[0].rows
    if (-not $rows -or $rows.Count -lt 2) { return $null }

    $freePct = $null; $freeMb = $null
    foreach ($row in $rows) {
        switch ($row[0]) {
            '% Free Space'    { $freePct = [double]$row[1] }
            'Free Megabytes'  { $freeMb  = [double]$row[1] }
        }
    }
    if ($null -eq $freePct -or $null -eq $freeMb) { return $null }

    $usedPct = [math]::Round(100 - $freePct, 1)
    $freeGB  = [math]::Round($freeMb / 1024, 1)
    # size = freeMB / (freePct/100)
    $sizeGB  = if ($freePct -gt 0) { [math]::Round(($freeMb / 1024) / ($freePct / 100), 1) } else { 0 }

    return @{ UsedPct = $usedPct; FreeGB = $freeGB; SizeGB = $sizeGB }
}

#endregion

#region --- Main ---

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host " Dakona AVD Disk Capacity Monitor" -ForegroundColor Cyan
Write-Host " Threshold: $ThresholdPercent% used | DryRun: $DryRun" -ForegroundColor Cyan
Write-Host " $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') UTC" -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan

# Validate
if (-not $TenantId -or -not $ClientId -or -not $ClientSecret) {
    Write-Host "ERROR: AZURE_SP_* env vars missing." -ForegroundColor Red; exit 1
}
if (-not $DryRun -and (-not $NinjaClientId -or -not $NinjaClientSecret)) {
    Write-Host "ERROR: NINJA_CLIENT_ID / NINJA_CLIENT_SECRET required (or use -DryRun)." -ForegroundColor Red; exit 1
}

# Tokens
Write-Host "Authenticating to Azure..." -ForegroundColor Yellow
$graphToken = Get-GraphToken
$armToken   = Get-ArmToken
$laToken    = Get-LaToken
Write-Host "Azure auth OK." -ForegroundColor Green

$ninja = $null
if (-not $DryRun) {
    Write-Host "Authenticating to NinjaOne ($NinjaInstance)..." -ForegroundColor Yellow
    $ninja = Get-NinjaToken
    Write-Host "NinjaOne auth OK." -ForegroundColor Green
}

# Enumerate tenants
Write-Host "`nEnumerating CSP customer tenants..." -ForegroundColor Yellow
$tenants = Get-CustomerTenants -Token $graphToken
if ($tenants.Count -eq 0) {
    Write-Host "No tenants found. Check SP permissions and Lighthouse delegation." -ForegroundColor Red; exit 1
}
Write-Host "Found $($tenants.Count) tenants.`n" -ForegroundColor Green

# Per-tenant scan
$report     = @()
$ticketsNew = 0
$ticketsDup = 0
$i = 0

foreach ($tenant in $tenants) {
    $i++
    Write-Host "[$i/$($tenants.Count)] $($tenant.DisplayName)" -ForegroundColor White

    $subs = Get-TenantSubscriptions -CustomerTenantId $tenant.TenantId -ArmToken $armToken
    if ($subs.Count -eq 0) { Write-Host "  No enabled subscriptions." -ForegroundColor Gray; continue }

    foreach ($sub in $subs) {
        $hosts = Get-AVDSessionHosts -SubscriptionId $sub.subscriptionId -ArmToken $armToken
        if ($hosts.Count -eq 0) { continue }

        Write-Host "  Sub '$($sub.displayName)': $($hosts.Count) AVD session host(s)" -ForegroundColor Gray

        foreach ($h in $hosts) {
            $wsId = Get-WorkspaceForVM -VMResourceId $h.VMResourceId -ArmToken $armToken
            if (-not $wsId) {
                Write-Host "    - $($h.Hostname): no Log Analytics workspace association" -ForegroundColor DarkYellow
                $report += [PSCustomObject]@{
                    Client = $tenant.DisplayName; HostPool = $h.HostPool; Hostname = $h.Hostname
                    Status = 'no-workspace'; UsedPct = $null; FreeGB = $null; Ticketed = $false
                }
                continue
            }

            $disk = Get-DiskUsageFromLA -WorkspaceCustomerId $wsId -Hostname $h.Hostname -LaToken $laToken
            if (-not $disk) {
                Write-Host "    - $($h.Hostname): no recent Perf data" -ForegroundColor DarkYellow
                $report += [PSCustomObject]@{
                    Client = $tenant.DisplayName; HostPool = $h.HostPool; Hostname = $h.Hostname
                    Status = 'no-data'; UsedPct = $null; FreeGB = $null; Ticketed = $false
                }
                continue
            }

            $line = "    - $($h.Hostname): $($disk.UsedPct)% used, $($disk.FreeGB) GB free of $($disk.SizeGB) GB"
            $ticketed = $false

            if ($disk.UsedPct -ge $ThresholdPercent) {
                Write-Host $line -ForegroundColor Red

                $priority = if ($disk.UsedPct -ge 90) { 'HIGH' } else { 'NORMAL' }
                $today    = Get-Date -Format 'yyyy-MM-dd'
                $subject  = "[$($tenant.DisplayName)] AVD disk capacity alert: $($h.Hostname) $($disk.UsedPct)% used ($today)"
                $bodyTxt  = @"
AVD session host C: drive is at or above the $ThresholdPercent% threshold.

Client:           $($tenant.DisplayName)
Tenant ID:        $($tenant.TenantId)
Host pool:        $($h.HostPool)
Resource group:   $($h.ResourceGroup)
Subscription:     $($sub.displayName) ($($sub.subscriptionId))
Session host:     $($h.Hostname)
Status:           $($h.Status)

Disk C:
  Used:           $($disk.UsedPct)%
  Free:           $($disk.FreeGB) GB
  Size:           $($disk.SizeGB) GB

Likely culprits on AVD:
  - FSLogix profile container growth (VHD/VHDX bloat)
  - Windows Update cache (C:\Windows\SoftwareDistribution\Download)
  - Defender / quarantine / WER dumps
  - User redirected folders not actually redirected

Recommended next steps:
  1. RDP / Bastion into the host and run WinDirStat or 'dir /s /b' under the
     largest folders.
  2. Clear WU cache: Stop-Service wuauserv; Remove-Item -Recurse C:\Windows\SoftwareDistribution\Download\*; Start-Service wuauserv
  3. Check FSLogix container sizes on the SMB share (not on C:, but verify users
     are not falling back to local profiles).
  4. If chronic, consider scaling the OS disk or trimming the image.

Detected by Dakona AVD Disk Monitor at $(Get-Date -Format 'u').
"@

                if ($DryRun) {
                    Write-Host "      [DRY RUN] would create NinjaOne ticket: $subject" -ForegroundColor Yellow
                    $ticketed = $true
                } else {
                    if (Test-NinjaDuplicateTicket -Subject $subject -Ninja $ninja) {
                        Write-Host "      [skip] open ticket already exists" -ForegroundColor DarkYellow
                        $ticketsDup++
                    } else {
                        try {
                            $t = New-NinjaTicket -Subject $subject -Body $bodyTxt -Priority $priority -Ninja $ninja
                            Write-Host "      [ticket] created NinjaOne #$($t.id) priority=$priority" -ForegroundColor Green
                            $ticketsNew++
                            $ticketed = $true
                        } catch {
                            Write-Host "      [error] ticket create failed: $($_.Exception.Message)" -ForegroundColor Red
                        }
                    }
                }
            } else {
                Write-Host $line -ForegroundColor Gray
            }

            $report += [PSCustomObject]@{
                Client         = $tenant.DisplayName
                TenantId       = $tenant.TenantId
                Subscription   = $sub.displayName
                HostPool       = $h.HostPool
                ResourceGroup  = $h.ResourceGroup
                Hostname       = $h.Hostname
                Status         = 'ok'
                UsedPct        = $disk.UsedPct
                FreeGB         = $disk.FreeGB
                SizeGB         = $disk.SizeGB
                Ticketed       = $ticketed
            }
        }
    }
}

# Summary
Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host " SUMMARY" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
$alerted = @($report | Where-Object { $_.UsedPct -ge $ThresholdPercent })
$ok      = @($report | Where-Object { $_.Status -eq 'ok' -and $_.UsedPct -lt $ThresholdPercent })
$blind   = @($report | Where-Object { $_.Status -ne 'ok' })

Write-Host " Hosts scanned:   $($report.Count)"
Write-Host " Healthy (<$ThresholdPercent%): $($ok.Count)" -ForegroundColor Green
Write-Host " At/over $ThresholdPercent%:    $($alerted.Count)" -ForegroundColor $(if ($alerted.Count -gt 0) {'Red'} else {'Green'})
Write-Host " No data:         $($blind.Count)" -ForegroundColor DarkYellow
if (-not $DryRun) {
    Write-Host " Tickets opened:  $ticketsNew (skipped $ticketsDup duplicates)" -ForegroundColor Cyan
}

# Save
$report | ConvertTo-Json -Depth 6 | Set-Content $OutputPath -Encoding UTF8
Write-Host "`nReport saved to: $OutputPath" -ForegroundColor Green

return $report
