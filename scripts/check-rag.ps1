$script = "sudo -u dkn8n bash -lc 'export PM2_HOME=/home/dkn8n/.pm2 && pm2 restart rag-api --update-env && sleep 5 && curl -s http://localhost:8000/ids'"
$result = az vm run-command invoke --resource-group DK-N8N_GROUP --name n8n --command-id RunShellScript --scripts $script --output json | ConvertFrom-Json
Write-Host "STDOUT:" $result.value[0].message
