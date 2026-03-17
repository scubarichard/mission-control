$files = @(
    "/app/node_modules/@librechat/agents/dist/cjs/graphs/Graph.cjs",
    "/app/node_modules/@librechat/agents/dist/cjs/agents/AgentGraph.cjs",
    "/app/api/server/controllers/agents/client.js"
)

foreach ($f in $files) {
    $r = az containerapp exec --name ca-dax-dakona-pilot --resource-group rg-dax-dakona-pilot --command "grep -n bindTools $f" 2>&1
    $lines = $r | Where-Object { $_ -notmatch "^ERROR:|^INFO:|^WARNING:|Connecting to|Successfully Connected" }
    if ($lines) {
        Write-Host "=== $f ==="
        $lines
    }
}
