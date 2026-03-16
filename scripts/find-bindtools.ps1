$r = az containerapp exec --name ca-dax-dakona-pilot --resource-group rg-dax-dakona-pilot --command "cat /app/node_modules/@librechat/agents/dist/cjs/graphs/Graph.cjs" 2>&1
$lines = @()
foreach ($line in $r) {
    if ($line -notmatch "^ERROR:|^INFO:|^WARNING:|Connecting to|Successfully Connected") {
        $lines += $line
    }
}
Write-Host "Total lines: $($lines.Count)"
# Find bindTools
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "bindTools") {
        Write-Host "Line $i`: $($lines[$i])"
        Write-Host "  -3: $($lines[$i-3])"
        Write-Host "  -2: $($lines[$i-2])"
        Write-Host "  -1: $($lines[$i-1])"
        Write-Host "  +1: $($lines[$i+1])"
        Write-Host "  +2: $($lines[$i+2])"
        Write-Host "  +3: $($lines[$i+3])"
        Write-Host "---"
    }
}
