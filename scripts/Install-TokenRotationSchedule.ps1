# ============================================================
# Install-TokenRotationSchedule.ps1
# Registers a monthly Windows Task Scheduler job to auto-rotate
# the DAX MCP Auth Token.
#
# Run ONCE as Administrator to install.
# ============================================================

$ErrorActionPreference = "Stop"

$TaskName    = "DAX-MCP-Token-Rotation"
$ScriptPath  = "P:\_clients\dakona\dax\scripts\Rotate-MCPToken.ps1"
$LogPath     = "P:\_clients\dakona\dax\scripts\token-rotation.log"

# Remove existing task if present
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed existing task: $TaskName"
}

# Action: run PowerShell with -Force to skip confirmation
$Action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -NonInteractive -File `"$ScriptPath`" -Force"

# Trigger: 1st of every month at 2:00 AM
$Trigger = New-ScheduledTaskTrigger `
    -Monthly `
    -DaysOfMonth 1 `
    -At "2:00AM"

# Settings: run whether logged on or not, wake to run
$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -RestartCount 2 `
    -RestartInterval (New-TimeSpan -Minutes 5) `
    -StartWhenAvailable `
    -WakeToRun

# Principal: run as current user (needs az CLI credentials)
$Principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType S4U `
    -RunLevel Highest

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description "Rotates DAX MCP server auth token monthly and updates Azure Container App" `
    -Force

Write-Host "`n=== Task Scheduled ===" -ForegroundColor Green
Write-Host "Task:     $TaskName"
Write-Host "Schedule: 1st of every month at 2:00 AM"
Write-Host "Script:   $ScriptPath"
Write-Host "Log:      $LogPath"
Write-Host "`nTo run now for testing:"
Write-Host "  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "`nTo check last run:"
Write-Host "  Get-ScheduledTaskInfo -TaskName '$TaskName'"
