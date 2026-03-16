$r = az containerapp exec --name ca-dax-dakona-pilot --resource-group rg-dax-dakona-pilot --command "cat /app/node_modules/@librechat/agents/dist/cjs/graphs/Graph.cjs" 2>&1
$lines = @()
foreach ($line in $r) {
    if ($line -notmatch "^ERROR:|^INFO:|^WARNING:|Connecting to|Successfully Connected") {
        $lines += $line
    }
}
Write-Host "=== Lines 1090-1195 (model setup before invoke) ==="
for ($i = 1090; $i -le 1195; $i++) {
    Write-Host "${i}: $($lines[$i])"
}
