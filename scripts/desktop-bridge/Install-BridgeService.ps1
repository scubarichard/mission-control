# ============================================================
# DAX Desktop Bridge — Install as Windows Service
# Run this ONCE as Administrator in PowerShell
# ============================================================

$ErrorActionPreference = "Stop"
$BridgeDir = "P:\_clients\dakona\dax\scripts\desktop-bridge"
$ServiceName = "DAX-Desktop-Bridge"

Write-Host "=== DAX Desktop Bridge Service Installer ===" -ForegroundColor Cyan

# Step 1: Check Node.js
Write-Host "`n[1/5] Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "  Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Error "Node.js not found. Please install it from https://nodejs.org"
    exit 1
}

# Step 2: Install npm dependencies
Write-Host "`n[2/5] Installing npm dependencies..." -ForegroundColor Yellow
Push-Location $BridgeDir
npm install --silent
Pop-Location
Write-Host "  Done" -ForegroundColor Green

# Step 3: Create .env if missing
Write-Host "`n[3/5] Checking .env config..." -ForegroundColor Yellow
$envFile = Join-Path $BridgeDir ".env"
if (-not (Test-Path $envFile)) {
    $bytes = New-Object Byte[] 24
    [Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
    $secret = [Convert]::ToBase64String($bytes)
    @"
BRIDGE_PORT=3001
BRIDGE_SECRET=$secret
BRIDGE_BASE_PATH=P:/_clients/dakona
BRIDGE_LOG=$BridgeDir\bridge.log
"@ | Set-Content $envFile
    Write-Host "  Created .env with random secret: $envFile" -ForegroundColor Green
} else {
    Write-Host "  .env exists — keeping config" -ForegroundColor Green
}

# Step 4: Install NSSM
Write-Host "`n[4/5] Installing NSSM..." -ForegroundColor Yellow
$nssmPath = "C:\Windows\System32\nssm.exe"
if (-not (Test-Path $nssmPath)) {
    $zip = "$env:TEMP\nssm.zip"
    Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile $zip
    Expand-Archive $zip -DestinationPath "$env:TEMP\nssm" -Force
    Copy-Item "$env:TEMP\nssm\nssm-2.24\win64\nssm.exe" $nssmPath -Force
    Write-Host "  NSSM installed" -ForegroundColor Green
} else {
    Write-Host "  NSSM already present" -ForegroundColor Green
}

# Step 5: Register and start service
Write-Host "`n[5/5] Registering Windows service..." -ForegroundColor Yellow
$nodePath = (Get-Command node).Source

# Remove if exists
if (Get-Service $ServiceName -ErrorAction SilentlyContinue) {
    nssm stop $ServiceName 2>$null
    nssm remove $ServiceName confirm 2>$null
    Start-Sleep -Seconds 2
}

nssm install $ServiceName $nodePath "bridge.js"
nssm set $ServiceName AppDirectory $BridgeDir
nssm set $ServiceName DisplayName "DAX Desktop Bridge"
nssm set $ServiceName Description "Connects Claude AI to Richard's local Windows environment"
nssm set $ServiceName Start SERVICE_AUTO_START
nssm set $ServiceName AppStdout "$BridgeDir\bridge.log"
nssm set $ServiceName AppStderr "$BridgeDir\bridge-error.log"
nssm set $ServiceName AppRotateFiles 1
nssm set $ServiceName AppRotateBytes 1048576

nssm start $ServiceName
Start-Sleep -Seconds 3

# Verify
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:3001/health" -TimeoutSec 5
    Write-Host "`n=== SUCCESS ===" -ForegroundColor Green
    Write-Host "Bridge running: $($health | ConvertTo-Json -Compress)" -ForegroundColor Green
    Write-Host "Starts automatically on every boot." -ForegroundColor Cyan
} catch {
    Write-Host "`n=== Check logs ===" -ForegroundColor Yellow
    Write-Host "Service installed but health check failed."
    Write-Host "Log: $BridgeDir\bridge.log"
}

Write-Host "`nService management:" -ForegroundColor Cyan
Write-Host "  nssm start $ServiceName"
Write-Host "  nssm stop $ServiceName"
Write-Host "  nssm status $ServiceName"
Write-Host "  Get-Content '$BridgeDir\bridge.log' -Tail 50"
