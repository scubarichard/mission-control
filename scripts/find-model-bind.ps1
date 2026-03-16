$r = az containerapp exec --name ca-dax-dakona-pilot --resource-group rg-dax-dakona-pilot --command "cat /app/node_modules/@librechat/agents/dist/cjs/graphs/Graph.cjs" 2>&1
$lines = @()
foreach ($line in $r) {
    if ($line -notmatch "^ERROR:|^INFO:|^WARNING:|Connecting to|Successfully Connected") {
        $lines += $line
    }
}
# Search for where model is created/assigned with tools before line 1244
for ($i = 980; $i -le 1090; $i++) {
    if ($lines[$i] -match "model|bindTools|tools") {
        Write-Host "${i}: $($lines[$i])"
    }
}
