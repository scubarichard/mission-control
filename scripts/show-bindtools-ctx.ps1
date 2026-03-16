$r = az containerapp exec --name ca-dax-dakona-pilot --resource-group rg-dax-dakona-pilot --command "cat /app/node_modules/@librechat/agents/dist/cjs/graphs/Graph.cjs" 2>&1
$lines = @()
foreach ($line in $r) {
    if ($line -notmatch "^ERROR:|^INFO:|^WARNING:|Connecting to|Successfully Connected") {
        $lines += $line
    }
}

Write-Host "=== Line 780-800 (first bindTools) ==="
$lines[780..800] | ForEach-Object { Write-Host $_ }

Write-Host ""
Write-Host "=== Line 1265-1295 (second bindTools) ==="
$lines[1265..1295] | ForEach-Object { Write-Host $_ }
