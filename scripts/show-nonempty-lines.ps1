$r = az containerapp exec --name ca-dax-dakona-pilot --resource-group rg-dax-dakona-pilot --command "cat /app/node_modules/@librechat/agents/dist/cjs/graphs/Graph.cjs" 2>&1
$lines = @()
foreach ($line in $r) {
    if ($line -notmatch "^ERROR:|^INFO:|^WARNING:|Connecting to|Successfully Connected") {
        $lines += $line
    }
}

# Find non-empty lines near the primary invoke
Write-Host "=== Non-empty lines from 900 to 1244 ==="
for ($i = 900; $i -le 1244; $i++) {
    if ($lines[$i].Trim() -ne "") {
        Write-Host "${i}: $($lines[$i])"
    }
}
