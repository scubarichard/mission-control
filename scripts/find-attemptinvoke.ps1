$r = az containerapp exec --name ca-dax-dakona-pilot --resource-group rg-dax-dakona-pilot --command "cat /app/node_modules/@librechat/agents/dist/cjs/graphs/Graph.cjs" 2>&1
$lines = @()
foreach ($line in $r) {
    if ($line -notmatch "^ERROR:|^INFO:|^WARNING:|Connecting to|Successfully Connected") {
        $lines += $line
    }
}
# Find attemptInvoke definition
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "attemptInvoke") {
        Write-Host "Line ${i}: $($lines[$i])"
    }
}
