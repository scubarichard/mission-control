$r = az containerapp exec --name ca-dax-dakona-pilot --resource-group rg-dax-dakona-pilot --command "cat /app/node_modules/@librechat/agents/dist/cjs/graphs/Graph.cjs" 2>&1
$lines = @()
foreach ($line in $r) {
    if ($line -notmatch "^ERROR:|^INFO:|^WARNING:|Connecting to|Successfully Connected") {
        $lines += $line
    }
}

# Find initializeModel definition
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "initializeModel\s*\(") {
        Write-Host "Line ${i}: $($lines[$i])"
    }
}
Write-Host ""
Write-Host "=== Lines 995-1020 (toolsForBinding + initializeModel call) ==="
for ($i = 995; $i -le 1025; $i++) {
    Write-Host "${i}: $($lines[$i])"
}
