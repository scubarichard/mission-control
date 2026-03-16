$r = az containerapp exec --name ca-dax-dakona-pilot --resource-group rg-dax-dakona-pilot --command "cat /app/node_modules/@librechat/agents/dist/cjs/graphs/Graph.cjs" 2>&1
$content = $r | Where-Object { $_ -notmatch "^ERROR:|^INFO:|^WARNING:" }
Write-Host "Lines: $($content.Count)"
$content[390..403]
Write-Host "---line 641 context---"
$content[636..650]
