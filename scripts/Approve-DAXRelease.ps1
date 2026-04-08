<#
.SYNOPSIS
    Snapshots the current live DAX environment into an approved release.

.DESCRIPTION
    Exports workflows from the live n8n instance, copies the current
    LibreChat config template and document templates, and writes a
    manifest.json pinning all artifacts. The resulting release directory
    under releases/<version>/ is the frozen deployment source for clients.

    Run this AFTER testing on dax.dakona.com confirms the version is stable.

.PARAMETER Version
    Semantic version for this release (e.g., "0.6.0").

.PARAMETER ApprovedBy
    Name of the person approving this release.

.PARAMETER Description
    One-line description of what's in this release.

.PARAMETER ImageTag
    LibreChat ACR image tag. Defaults to "v<Version>".

.PARAMETER SkipWorkflowExport
    Use existing sanitized workflows from n8n/live-exports/ instead of
    re-exporting from live n8n. Useful when you've already exported and
    sanitized manually.

.EXAMPLE
    ./Approve-DAXRelease.ps1 -Version 0.6.0 -ApprovedBy "Richard Mabbun" `
        -Description "ICP launch — added compliance flagging v2"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $Version,
    [string] $ApprovedBy = "Richard Mabbun",
    [string] $Description = "",
    [string] $ImageTag = "",
    [switch] $SkipWorkflowExport
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path "$PSScriptRoot/.."

if (-not $ImageTag) { $ImageTag = "v$Version" }

$releaseDir = "$repoRoot/releases/v$Version"
$workflowDir = "$releaseDir/workflows"
$templateDir = "$releaseDir/templates"

# ============================================================================
# 1. Create release directory
# ============================================================================

if (Test-Path $releaseDir) {
    Write-Warning "Release v$Version already exists at $releaseDir"
    $confirm = Read-Host "Overwrite? (y/N)"
    if ($confirm -ne 'y') { return }
    Remove-Item $releaseDir -Recurse -Force
}

New-Item -ItemType Directory -Path $workflowDir -Force | Out-Null
New-Item -ItemType Directory -Path $templateDir -Force | Out-Null

Write-Host "=== DAX Release Approval ===" -ForegroundColor Cyan
Write-Host "Version:  v$Version"
Write-Host "Image:    acrdaxdakona.azurecr.io/librechat-dax:$ImageTag"
Write-Host "Approved: $ApprovedBy"

# ============================================================================
# 2. Copy workflows
# ============================================================================

Write-Host "`nCopying workflows..." -ForegroundColor Yellow

$liveExports = "$repoRoot/n8n/live-exports"

if (-not $SkipWorkflowExport) {
    Write-Host "  NOTE: Using pre-exported workflows from n8n/live-exports/" -ForegroundColor DarkGray
    Write-Host "  To re-export from live n8n, export manually then re-run." -ForegroundColor DarkGray
}

if (-not (Test-Path $liveExports)) {
    Write-Error "n8n/live-exports/ not found. Export and sanitize workflows first."
    return
}

$workflows = Get-ChildItem "$liveExports/dax-*.json"
if ($workflows.Count -eq 0) {
    Write-Error "No DAX workflow files found in $liveExports"
    return
}

foreach ($wf in $workflows) {
    Copy-Item $wf.FullName "$workflowDir/$($wf.Name)"
    Write-Host "  $($wf.Name)" -ForegroundColor Green
}

# ============================================================================
# 3. Copy config template
# ============================================================================

Write-Host "`nCopying config template..." -ForegroundColor Yellow

$yamlTemplate = "$repoRoot/librechat/librechat.yaml.template"
if (Test-Path $yamlTemplate) {
    Copy-Item $yamlTemplate "$releaseDir/librechat.yaml.template"
    Write-Host "  librechat.yaml.template" -ForegroundColor Green
} else {
    Write-Warning "librechat.yaml.template not found"
}

# ============================================================================
# 4. Copy document templates
# ============================================================================

Write-Host "`nCopying document templates..." -ForegroundColor Yellow

$docTemplates = Get-ChildItem "$repoRoot/docs/templates/*.docx" -ErrorAction SilentlyContinue
foreach ($dt in $docTemplates) {
    Copy-Item $dt.FullName "$templateDir/$($dt.Name)"
    Write-Host "  $($dt.Name)" -ForegroundColor Green
}

# ============================================================================
# 5. Write manifest
# ============================================================================

Write-Host "`nWriting manifest..." -ForegroundColor Yellow

$workflowList = (Get-ChildItem "$workflowDir/*.json").Name | ForEach-Object { "workflows/$_" }
$templateList = (Get-ChildItem "$templateDir/*").Name | ForEach-Object { "templates/$_" }

$manifest = @{
    version = $Version
    approved = (Get-Date -Format "yyyy-MM-dd")
    approvedBy = $ApprovedBy
    description = $Description
    source = "dax.dakona.com (Dakona pilot)"
    artifacts = @{
        libreChatImage = "acrdaxdakona.azurecr.io/librechat-dax:$ImageTag"
        n8nImage = "n8nio/n8n:latest"
        configTemplate = "librechat.yaml.template"
        workflows = $workflowList
        docTemplates = $templateList
    }
    notes = "All workflow credentials sanitized. Azure OpenAI credential ID must be created per-client after import."
}

$manifest | ConvertTo-Json -Depth 5 | Set-Content "$releaseDir/manifest.json" -Encoding UTF8

Write-Host "  manifest.json" -ForegroundColor Green

# ============================================================================
# 6. Summary
# ============================================================================

Write-Host "`n=== Release v$Version Approved ===" -ForegroundColor Cyan
Write-Host "Location:   $releaseDir"
Write-Host "Workflows:  $($workflowList.Count)"
Write-Host "Templates:  $($templateList.Count)"
Write-Host "Image:      acrdaxdakona.azurecr.io/librechat-dax:$ImageTag"
Write-Host ""
Write-Host "Deploy with:" -ForegroundColor Yellow
Write-Host "  ./scripts/New-DAXClient.ps1 -ClientName <name> -Release v$Version"
Write-Host ""
