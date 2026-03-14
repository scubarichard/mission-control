<#
.SYNOPSIS
    Tests the DAX Document Generator n8n workflow.
.DESCRIPTION
    Sends a sample POST request to the document-generator webhook
    endpoint with all supported placeholder fields.
.PARAMETER WebhookBaseUrl
    Base URL of the n8n instance (e.g. https://n8n.example.com).
    Defaults to http://localhost:5678.
#>
param(
    [string]$WebhookBaseUrl = "http://localhost:5678"
)

$url = "$WebhookBaseUrl/webhook/generate-document"

$body = @{
    firmName           = "Dakona Wealth Advisors"
    clientName         = "John Smith"
    reportPeriod       = "Q1 2026"
    reportDate         = "2026-03-31"
    advisorName        = "Sarah Johnson"
    meetingDate        = "2026-04-05"
    meetingLocation    = "Conference Room B"
    attendees          = "John Smith, Sarah Johnson, Mike Chen"
    meetingDuration    = "60 minutes"
    discussionPoint1   = "Portfolio rebalancing review"
    discussionPoint2   = "Tax-loss harvesting opportunities"
    discussionPoint3   = "Estate planning update"
    advisorNotes       = "Client expressed interest in increasing international exposure."
    portfolioValue     = "`$2,450,000"
    ytdReturn          = "8.3%"
    benchmarkReturn    = "7.1%"
    vsBenchmark        = "+1.2%"
    goal1              = "Retirement by age 62"
    goal2              = "Education funding for two children"
    goal3              = "Charitable giving strategy"
    goalsProgressNotes = "On track for all primary goals."
    action1            = "Rebalance international allocation"
    action1Owner       = "Sarah Johnson"
    action1Due         = "2026-04-15"
    action2            = "Review 529 plan contributions"
    action2Owner       = "Mike Chen"
    action2Due         = "2026-04-20"
    action3            = "Draft charitable trust proposal"
    action3Owner       = "Sarah Johnson"
    action3Due         = "2026-05-01"
    nextMeetingDate    = "2026-07-10"
    nextMeetingAgenda  = "Mid-year review, tax planning"
    accountNumber      = "ICP-7842-A"
    accountType        = "Taxable Brokerage"
    riskProfile        = "Moderate Growth"
} | ConvertTo-Json -Depth 3

Write-Host "POST $url" -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json"
    Write-Host "SUCCESS" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Host $reader.ReadToEnd() -ForegroundColor Yellow
    }
}
