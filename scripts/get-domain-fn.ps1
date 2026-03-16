
$out = az containerapp exec --name ca-dax-dakona-pilot --resource-group rg-dax-dakona-pilot --command "cat /app/node_modules/@librechat/api/dist/index.js" 2>&1
# Remove connection header lines, keep content lines
$content = $out | Where-Object { $_ -notmatch "^ERROR:|^INFO:|^WARNING:" }
$content[3776..3830]
