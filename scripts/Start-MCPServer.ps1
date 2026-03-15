<#
.SYNOPSIS
    Starts the DAX MCP (Model Context Protocol) server.

.DESCRIPTION
    Changes to the mcp/ directory, installs npm dependencies if needed,
    then starts the MCP server via Node.js with stdio transport.

.EXAMPLE
    ./Start-MCPServer.ps1
#>

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$mcpDir   = Join-Path $repoRoot 'mcp'

Push-Location $mcpDir
try {
    if (-not (Test-Path (Join-Path $mcpDir 'node_modules'))) {
        Write-Host "Installing dependencies..." -ForegroundColor Cyan
        npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
    }

    Write-Host "Starting DAX MCP server..." -ForegroundColor Cyan
    node server.js
}
finally {
    Pop-Location
}
