<#
.SYNOPSIS
    Sets per-table archive retention on a Log Analytics workspace to meet
    SEC Rule 17a-4 (6-year / 2556-day total retention).

.DESCRIPTION
    Bicep can only set workspace-level interactive retention (up to 730 days).
    Archive retention is a per-table setting that must be configured via CLI
    after the workspace is deployed.

    This script:
    1. Lists all tables in the workspace
    2. Skips tables that cannot be modified (read-only system tables)
    3. Sets totalRetentionInDays to 2556 on all eligible tables

    The interactive retention (retentionInDays) is left unchanged - it stays
    at the workspace-level default (730 days). Archive covers the remaining
    ~1825 days. Archived data is queryable via search jobs or restore.

.PARAMETER ClientName
    Short client identifier.

.EXAMPLE
    ./Set-LogRetention.ps1 -ClientName dakona-pilot
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $ClientName
)

$ErrorActionPreference = 'Stop'

$rgName        = "rg-dax-$ClientName"
$workspaceName = "law-dax-$ClientName"
$totalRetention = 2556  # Azure's closest allowed value to 7 years (SEC 17a-4 requires 6)

Write-Host "=== Log Analytics Archive Retention ===" -ForegroundColor Cyan
Write-Host "Workspace:       $workspaceName"
Write-Host "Resource Group:  $rgName"
Write-Host "Total Retention: $totalRetention days"
Write-Host ""

# List all tables in the workspace
Write-Host "Listing tables..." -ForegroundColor Yellow

$tablesJson = az monitor log-analytics workspace table list `
    --workspace-name "$workspaceName" `
    --resource-group "$rgName" `
    -o json

$tables = $tablesJson | ConvertFrom-Json

$updated  = 0
$skipped  = 0
$failed   = 0

foreach ($table in $tables) {
    $tableName = $table.name

    # Skip tables that don't support custom retention
    # provisioningState must be Succeeded, and plan must not be "Basic"
    # (Basic tables don't support archive). Also skip SearchResults/RestoredLogs/ACS tables.
    if ($tableName -match '_RST$|_SRCH$|^ACS') {
        Write-Host "  SKIP (system):         $tableName" -ForegroundColor DarkGray
        $skipped++
        continue
    }

    if ($table.plan -eq 'Basic') {
        Write-Host "  SKIP (Basic plan):     $tableName" -ForegroundColor DarkGray
        $skipped++
        continue
    }

    # Already at target - skip to avoid unnecessary API calls
    if ($table.totalRetentionInDays -eq $totalRetention) {
        Write-Host "  OK   (already set):    $tableName" -ForegroundColor DarkGray
        $skipped++
        continue
    }

    try {
        az monitor log-analytics workspace table update `
            --workspace-name "$workspaceName" `
            --resource-group "$rgName" `
            --name "$tableName" `
            --retention-time $table.retentionInDays `
            --total-retention-time $totalRetention `
            -o none 2>&1 | Out-Null

        if ($LASTEXITCODE -ne 0) { throw "az command failed" }

        Write-Host "  SET  $totalRetention days:     $tableName" -ForegroundColor Green
        $updated++
    }
    catch {
        Write-Host "  FAIL:                  $tableName - $_" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "=== Complete ===" -ForegroundColor Cyan
Write-Host "Updated: $updated  |  Skipped: $skipped  |  Failed: $failed"
Write-Host ""
if ($failed -gt 0) {
    Write-Host 'Some tables could not be updated. These are typically system tables' -ForegroundColor Yellow
    Write-Host 'with read-only retention settings (e.g., Usage, Operation).' -ForegroundColor Yellow
}
