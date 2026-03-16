$r = az containerapp exec --name ca-dax-dakona-pilot --resource-group rg-dax-dakona-pilot --command "cat /app/node_modules/@librechat/agents/dist/cjs/graphs/Graph.cjs" 2>&1
$lines = @()
foreach ($line in $r) {
    if ($line -notmatch "^ERROR:|^INFO:|^WARNING:|Connecting to|Successfully Connected") {
        $lines += $line
    }
}
Write-Host "Lines: $($lines.Count)"
# Show lines 385-410 (around hasActionTool)
for ($i = 385; $i -le 415; $i++) {
    if ($lines[$i].Trim() -ne "") {
        Write-Host "${i}: $($lines[$i])"
    }
}
