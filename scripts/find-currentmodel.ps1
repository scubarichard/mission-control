$r = az containerapp exec --name ca-dax-dakona-pilot --resource-group rg-dax-dakona-pilot --command "grep -n currentModel /app/node_modules/@librechat/agents/dist/cjs/graphs/Graph.cjs" 2>&1
$lines = $r | Where-Object { $_ -notmatch "^ERROR:|^INFO:|^WARNING:|Connecting to|Successfully Connected" }
$lines | Select-Object -First 20
