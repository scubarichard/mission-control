$r = az containerapp exec --name ca-dax-dakona-pilot --resource-group rg-dax-dakona-pilot --command "cat /app/node_modules/@librechat/agents/dist/cjs/graphs/Graph.cjs" 2>&1
$lines = @()
foreach ($line in $r) {
    if ($line -notmatch "^ERROR:|^INFO:|^WARNING:|Connecting to|Successfully Connected") {
        $lines += $line
    }
}

Write-Host "Total lines: $($lines.Count)"
# The file might be read differently. Let's check line density
$nonEmpty = 0
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -and $lines[$i].Trim() -ne "") { $nonEmpty++ }
}
Write-Host "Non-empty lines: $nonEmpty"

# Show lines 790-795 which we know has content (bindTools)
Write-Host "=== Lines 788-795 ==="
for ($i = 788; $i -le 795; $i++) {
    Write-Host "${i}|$($lines[$i])|"
}
