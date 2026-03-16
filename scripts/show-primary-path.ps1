$r = az containerapp exec --name ca-dax-dakona-pilot --resource-group rg-dax-dakona-pilot --command "cat /app/node_modules/@librechat/agents/dist/cjs/graphs/Graph.cjs" 2>&1
$lines = @()
foreach ($line in $r) {
    if ($line -notmatch "^ERROR:|^INFO:|^WARNING:|Connecting to|Successfully Connected") {
        $lines += $line
    }
}
# Show the area around the primary attemptInvoke call (line 1244) - go back further to see model binding
Write-Host "=== Lines 1190-1260 (primary invoke path) ==="
for ($i = 1190; $i -le 1260; $i++) {
    Write-Host "${i}: $($lines[$i])"
}
