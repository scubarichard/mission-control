<#
.SYNOPSIS
    Wraps Dax-Frontpage.png in a valid SVG file for LibreChat logo.

.DESCRIPTION
    LibreChat expects logo.svg as an SVG file. This script base64-encodes
    the PNG logo and wraps it in an SVG <image> element so the browser
    renders it correctly.

.EXAMPLE
    ./Build-LogoSvg.ps1
#>

$ErrorActionPreference = 'Stop'

$pngPath = "$PSScriptRoot/../docs/Dax-Frontpage.png"
$svgPath = "$PSScriptRoot/../docs/logo.svg"

if (-not (Test-Path $pngPath)) {
    Write-Error "PNG not found: $pngPath"
    return
}

Write-Host "Reading $pngPath..." -ForegroundColor Yellow
$pngBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $pngPath).Path)
$base64 = [System.Convert]::ToBase64String($pngBytes)
Write-Host "  Encoded $($pngBytes.Length) bytes -> $($base64.Length) chars base64"

$svg = @"
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     viewBox="0 0 400 200">
  <image href="data:image/png;base64,$base64"
         width="400" height="200"/>
</svg>
"@

$outPath = Join-Path (Resolve-Path "$PSScriptRoot/../docs").Path "logo.svg"
[System.IO.File]::WriteAllText($outPath, $svg)

Write-Host "  Written: $outPath ($($svg.Length) chars)" -ForegroundColor Green
