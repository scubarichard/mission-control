<#
.SYNOPSIS
    Configures Microsoft Purview DLP and Communication Compliance policies
    for a DAX client tenant.

.DESCRIPTION
    Creates:
    1. DLP policy — blocks sharing of PII/financial data (SSN, account numbers)
       in LibreChat conversations
    2. Communication Compliance policy — monitors AI chat for regulatory terms
       and investment advice red flags

    Requires: Exchange Online PowerShell module + Compliance admin role in client tenant.

.PARAMETER ClientName
    Short client identifier.

.PARAMETER ClientTenantId
    Client Entra ID tenant ID (used for Connect-IPPSSession).

.PARAMETER ComplianceAdminUpn
    UPN of a Compliance Administrator in the client tenant.

.EXAMPLE
    ./Deploy-PurviewPolicies.ps1 -ClientName acme `
        -ClientTenantId "00000000-..." `
        -ComplianceAdminUpn "compliance@acmeria.com"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $ClientName,
    [Parameter(Mandatory)] [string] $ClientTenantId,
    [Parameter(Mandatory)] [string] $ComplianceAdminUpn
)

$ErrorActionPreference = 'Stop'

Write-Host "=== DAX Purview Policy Deployment ===" -ForegroundColor Cyan
Write-Host "Client: $ClientName"
Write-Host "Tenant: $ClientTenantId"

# ---------- Connect to Security & Compliance ----------
Write-Host "`nConnecting to Security & Compliance PowerShell..." -ForegroundColor Yellow

if (-not (Get-Module -ListAvailable ExchangeOnlineManagement)) {
    Install-Module ExchangeOnlineManagement -Force -Scope CurrentUser
}
Import-Module ExchangeOnlineManagement

Connect-IPPSSession -UserPrincipalName $ComplianceAdminUpn

# ============================================================================
# 1. DLP Policy — Block PII / Financial Data
# ============================================================================

$dlpPolicyName = "DAX - Block PII and Financial Data"

Write-Host "`nCreating DLP policy: $dlpPolicyName" -ForegroundColor Yellow

# Check if policy already exists
$existingDlp = Get-DlpCompliancePolicy -Identity $dlpPolicyName -ErrorAction SilentlyContinue
if ($existingDlp) {
    Write-Host "  DLP policy already exists, skipping creation." -ForegroundColor DarkYellow
} else {
    # Create the DLP policy scoped to all Exchange locations (covers Teams/chat)
    New-DlpCompliancePolicy `
        -Name $dlpPolicyName `
        -Comment "DAX: Prevents sharing of SSNs, financial account numbers, and other PII in AI chat." `
        -ExchangeLocation "All" `
        -Mode "Enable"

    # Rule: Block SSN
    New-DlpComplianceRule `
        -Name "DAX - Block SSN" `
        -Policy $dlpPolicyName `
        -ContentContainsSensitiveInformation @(
            @{ Name = "U.S. Social Security Number (SSN)"; minCount = 1 }
        ) `
        -BlockAccess $true `
        -NotifyUser "SiteAdmin" `
        -GenerateIncidentReport "SiteAdmin"

    # Rule: Block financial account numbers
    New-DlpComplianceRule `
        -Name "DAX - Block Financial Account Numbers" `
        -Policy $dlpPolicyName `
        -ContentContainsSensitiveInformation @(
            @{ Name = "U.S. Bank Account Number"; minCount = 1 },
            @{ Name = "Credit Card Number"; minCount = 1 },
            @{ Name = "U.S. Individual Taxpayer Identification Number (ITIN)"; minCount = 1 }
        ) `
        -BlockAccess $true `
        -NotifyUser "SiteAdmin" `
        -GenerateIncidentReport "SiteAdmin"

    Write-Host "  DLP policy created." -ForegroundColor Green
}

# ============================================================================
# 2. Communication Compliance — Monitor for regulatory concerns
# ============================================================================

$ccPolicyName = "DAX - AI Chat Compliance Monitoring"

Write-Host "`nCreating Communication Compliance policy: $ccPolicyName" -ForegroundColor Yellow

$existingCc = Get-SupervisoryReviewPolicyV2 -Identity $ccPolicyName -ErrorAction SilentlyContinue
if ($existingCc) {
    Write-Host "  Communication Compliance policy already exists, skipping." -ForegroundColor DarkYellow
} else {
    # Keywords that flag potential regulatory issues for RIAs
    $keywords = @(
        "guaranteed returns",
        "risk free",
        "sure thing",
        "can't lose",
        "insider information",
        "material non-public",
        "front running",
        "cherry picking",
        "unauthorized trading",
        "promissory note",
        "high yield investment program"
    )

    New-SupervisoryReviewPolicyV2 `
        -Name $ccPolicyName `
        -Comment "DAX: Monitors AI chat for investment advice red flags and regulatory terms." `
        -Reviewers $ComplianceAdminUpn `
        -SamplingRate 100

    # Add keyword condition
    New-SupervisoryReviewRule `
        -Name "DAX - Regulatory Keywords" `
        -Policy $ccPolicyName `
        -Condition "(MessageContainsWords -Words '$($keywords -join "','")')" `
        -SamplingRate 100

    Write-Host "  Communication Compliance policy created." -ForegroundColor Green
}

# ---------- Disconnect ----------
Disconnect-ExchangeOnline -Confirm:$false -ErrorAction SilentlyContinue

Write-Host "`n=== Purview policy deployment complete ===" -ForegroundColor Green
