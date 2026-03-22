<#
.SYNOPSIS
  Sets up the DAX Desktop Bridge: installs deps, creates .env, installs
  cloudflared, creates a Cloudflare Tunnel, and registers Windows Scheduled Tasks.
.PARAMETER Force
  Overwrite existing .env file with a new secret.
#>
[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$RepoRoot   = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$BridgeDir  = Join-Path $RepoRoot "scripts\desktop-bridge"
$EnvFile    = Join-Path $BridgeDir ".env"
$TunnelName = "dax-desktop"
$BridgePort = 3001

Write-Host "`n=== DAX Desktop Bridge Setup ===" -ForegroundColor Cyan

# ── 1. npm install ───────────────────────────────────────────────────
Write-Host "`n[1/6] Installing Node dependencies..." -ForegroundColor Yellow
Push-Location $BridgeDir
try {
    npm install --production 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
} finally {
    Pop-Location
}

# ── 2. Generate .env ────────────────────────────────────────────────
Write-Host "`n[2/6] Configuring .env..." -ForegroundColor Yellow
if ((Test-Path $EnvFile) -and -not $Force) {
    Write-Host "  .env already exists (use -Force to regenerate)" -ForegroundColor DarkGray
    $Secret = (Get-Content $EnvFile | Where-Object { $_ -match "^BRIDGE_SECRET=" }) -replace "^BRIDGE_SECRET=", ""
} else {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $Secret = [Convert]::ToBase64String($bytes) -replace '[+/=]', ''
    $Secret = $Secret.Substring(0, [Math]::Min(40, $Secret.Length))

    @"
BRIDGE_PORT=$BridgePort
BRIDGE_SECRET=$Secret
BRIDGE_BASE_PATH=P:/_clients/dakona
BRIDGE_LOG=bridge.log
"@ | Set-Content $EnvFile -Encoding UTF8
    Write-Host "  Generated new .env with secret" -ForegroundColor Green
}

# ── 3. Install cloudflared ──────────────────────────────────────────
Write-Host "`n[3/6] Checking cloudflared..." -ForegroundColor Yellow
$CfDir = Join-Path $env:ProgramFiles "cloudflared"
$CfExe = Join-Path $CfDir "cloudflared.exe"

if (Test-Path $CfExe) {
    Write-Host "  cloudflared already installed at $CfExe" -ForegroundColor DarkGray
} else {
    Write-Host "  Downloading cloudflared..." -ForegroundColor White
    New-Item -ItemType Directory -Path $CfDir -Force | Out-Null
    $dlUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    Invoke-WebRequest -Uri $dlUrl -OutFile $CfExe -UseBasicParsing
    Write-Host "  Installed to $CfExe" -ForegroundColor Green
}

# ── 4. Create or reuse Cloudflare Tunnel ────────────────────────────
Write-Host "`n[4/6] Setting up Cloudflare Tunnel '$TunnelName'..." -ForegroundColor Yellow

# Check if already logged in
$tunnelList = & $CfExe tunnel list --output json 2>&1
if ($LASTEXITCODE -ne 0 -or $tunnelList -match "error") {
    Write-Host "  You need to log in to Cloudflare first." -ForegroundColor Red
    Write-Host "  Running: cloudflared tunnel login" -ForegroundColor White
    & $CfExe tunnel login
    $tunnelList = & $CfExe tunnel list --output json 2>&1
}

$existing = $tunnelList | ConvertFrom-Json | Where-Object { $_.name -eq $TunnelName }
if ($existing) {
    $TunnelId = $existing.id
    Write-Host "  Reusing existing tunnel: $TunnelId" -ForegroundColor DarkGray
} else {
    $createOut = & $CfExe tunnel create $TunnelName 2>&1
    Write-Host "  $createOut"
    $TunnelId = (& $CfExe tunnel list --output json | ConvertFrom-Json | Where-Object { $_.name -eq $TunnelName }).id
    Write-Host "  Created tunnel: $TunnelId" -ForegroundColor Green
}

# ── 5. Write cloudflared config ─────────────────────────────────────
Write-Host "`n[5/6] Writing cloudflared config..." -ForegroundColor Yellow
$CfConfigDir = Join-Path $env:USERPROFILE ".cloudflared"
$CfConfig    = Join-Path $CfConfigDir "config.yml"
New-Item -ItemType Directory -Path $CfConfigDir -Force | Out-Null

@"
tunnel: $TunnelId
credentials-file: $CfConfigDir\$TunnelId.json

ingress:
  - hostname: ""
    service: http://localhost:$BridgePort
"@ | Set-Content $CfConfig -Encoding UTF8
Write-Host "  Wrote $CfConfig" -ForegroundColor Green

# Get the tunnel URL
$TunnelUrl = "https://$TunnelId.cfargotunnel.com"

# ── 6. Register Windows Scheduled Tasks ─────────────────────────────
Write-Host "`n[6/6] Creating Windows Scheduled Tasks..." -ForegroundColor Yellow

$NodeExe = (Get-Command node).Source
$bridgeAction  = New-ScheduledTaskAction -Execute $NodeExe -Argument "bridge.js" -WorkingDirectory $BridgeDir
$tunnelAction  = New-ScheduledTaskAction -Execute $CfExe -Argument "tunnel run $TunnelName"
$trigger       = New-ScheduledTaskTrigger -AtLogOn
$settings      = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

# DAX-Desktop-Bridge task
$existingTask = Get-ScheduledTask -TaskName "DAX-Desktop-Bridge" -ErrorAction SilentlyContinue
if ($existingTask) {
    Set-ScheduledTask -TaskName "DAX-Desktop-Bridge" -Action $bridgeAction -Trigger $trigger -Settings $settings | Out-Null
    Write-Host "  Updated task: DAX-Desktop-Bridge" -ForegroundColor DarkGray
} else {
    Register-ScheduledTask -TaskName "DAX-Desktop-Bridge" -Action $bridgeAction -Trigger $trigger -Settings $settings -Description "DAX Desktop Bridge (Node.js on port $BridgePort)" | Out-Null
    Write-Host "  Created task: DAX-Desktop-Bridge" -ForegroundColor Green
}

# DAX-Cloudflare-Tunnel task
$existingTask = Get-ScheduledTask -TaskName "DAX-Cloudflare-Tunnel" -ErrorAction SilentlyContinue
if ($existingTask) {
    Set-ScheduledTask -TaskName "DAX-Cloudflare-Tunnel" -Action $tunnelAction -Trigger $trigger -Settings $settings | Out-Null
    Write-Host "  Updated task: DAX-Cloudflare-Tunnel" -ForegroundColor DarkGray
} else {
    Register-ScheduledTask -TaskName "DAX-Cloudflare-Tunnel" -Action $tunnelAction -Trigger $trigger -Settings $settings -Description "Cloudflare Tunnel for DAX Desktop Bridge" | Out-Null
    Write-Host "  Created task: DAX-Cloudflare-Tunnel" -ForegroundColor Green
}

# Start both tasks now
Start-ScheduledTask -TaskName "DAX-Desktop-Bridge"
Start-ScheduledTask -TaskName "DAX-Cloudflare-Tunnel"
Write-Host "  Both tasks started." -ForegroundColor Green

# ── Summary ─────────────────────────────────────────────────────────
Write-Host "`n=== Setup Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Tunnel URL:     $TunnelUrl" -ForegroundColor White
Write-Host "  Bridge Secret:  $Secret" -ForegroundColor White
Write-Host "  Bridge Port:    $BridgePort" -ForegroundColor White
Write-Host "  Bridge Dir:     $BridgeDir" -ForegroundColor White
Write-Host ""
Write-Host "  NEXT STEPS:" -ForegroundColor Yellow
Write-Host "  1. Add these env vars to the Azure Container App (ca-dax-mcp-dakona-pilot):" -ForegroundColor White
Write-Host "       DESKTOP_BRIDGE_URL=$TunnelUrl" -ForegroundColor Green
Write-Host "       DESKTOP_BRIDGE_SECRET=$Secret" -ForegroundColor Green
Write-Host ""
Write-Host "  2. Or via CLI:" -ForegroundColor White
Write-Host "       az containerapp update -n ca-dax-mcp-dakona-pilot -g rg-dax-dakona-pilot ``" -ForegroundColor DarkGray
Write-Host "         --set-env-vars DESKTOP_BRIDGE_URL=$TunnelUrl DESKTOP_BRIDGE_SECRET=$Secret" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  3. Test: ask Claude 'Run desktop_run_powershell with command: Get-Date'" -ForegroundColor White
Write-Host ""
