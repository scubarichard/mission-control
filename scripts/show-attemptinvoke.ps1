$r = az containerapp exec --name ca-dax-dakona-pilot --resource-group rg-dax-dakona-pilot --command "cat /app/node_modules/@librechat/agents/dist/cjs/graphs/Graph.cjs" 2>&1
$lines = @()
foreach ($line in $r) {
    if ($line -notmatch "^ERROR:|^INFO:|^WARNING:|Connecting to|Successfully Connected") {
        $lines += $line
    }
}
Write-Host "=== attemptInvoke definition (lines 832-900) ==="
for ($i = 832; $i -le 900; $i++) {
    Write-Host "${i}: $($lines[$i])"
}
