# DAX Dev VM

Ubuntu 22.04 VM in Azure for running the DAX MCP server. No public IP — access via Azure Bastion or SSH from an existing jumpbox.

## Provisioning

```powershell
./scripts/Deploy-DevVM.ps1
```

Default settings: `vm-dax-dev`, `daxadmin`, `Standard_B1s`, `~/.ssh/id_rsa.pub`.

Override:
```powershell
./scripts/Deploy-DevVM.ps1 -VMName vm-dax-dev-2 -AdminUsername azureuser -SshKeyPath ~/.ssh/dax_key.pub
```

Cloud-init runs in the background after the VM is created. It installs Node.js 20, Azure CLI, PM2, clones the repo, and starts the MCP server. Takes 3-5 minutes to complete.

## Infrastructure

| Property | Value |
|---|---|
| Resource Group | dk-n8n_group |
| VNet / Subnet | vnet-eastus / snet-eastus-1 |
| VM Size | Standard_B1s (1 vCPU, 1 GiB) |
| OS | Ubuntu 22.04 LTS |
| Managed Identity | Contributor on rg-dax-dakona-pilot |
| Public IP | None |

## SSH Access

From a jumpbox or machine with VNet access:
```bash
ssh daxadmin@<PRIVATE_IP>
```

Check the private IP:
```powershell
az vm show -g dk-n8n_group -n vm-dax-dev --show-details --query "privateIps" -o tsv
```

## MCP Server

### Check status
```bash
pm2 status
pm2 logs dax-mcp
```

### Restart
```bash
pm2 restart dax-mcp
```

### Stop / Start
```bash
pm2 stop dax-mcp
pm2 start dax-mcp
```

## Update DAX Repo

```bash
cd /opt/dax
git pull
cd mcp && npm install
pm2 restart dax-mcp
```

## Connect Claude Desktop to VM MCP Server

### Option 1: SSH stdio transport (recommended)

Add to `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "dax-dev-vm": {
      "command": "ssh",
      "args": [
        "-T",
        "-i", "C:/Users/18473/.ssh/id_rsa",
        "-o", "StrictHostKeyChecking=no",
        "-o", "BatchMode=yes",
        "-J", "dkn8n@n8n.dakona.net",
        "daxadmin@172.16.0.5",
        "bash -c 'node /opt/dax/mcp/server.js'"
      ]
    }
  }
}
```

This uses SSH as the transport — Claude Desktop launches SSH, which runs the MCP server on the VM with stdio piped over the SSH connection. Key details:
- `-T` disables pseudo-TTY allocation (required for MCP stdio)
- `-J` uses the n8n jumpbox as a ProxyJump since the VM has no public IP
- `bash -c` wraps the remote command so Windows SSH doesn't mangle argument splitting
- `BatchMode=yes` prevents interactive password prompts that would hang Claude Desktop

### Option 2: Local (for testing)

```json
{
  "mcpServers": {
    "dax-dev-local": {
      "command": "node",
      "args": ["P:/_clients/dakona/dax/mcp/server.js"],
      "env": {
        "DAX_REPO_PATH": "P:/_clients/dakona/dax",
        "AZURE_SUBSCRIPTION": "36676e89-8ccf-4390-8602-e57a913755dc",
        "AZURE_RG": "rg-dax-dakona-pilot",
        "AZURE_CONTAINER_APP": "ca-dax-dakona-pilot",
        "N8N_URL": "https://n8n.dakona.net"
      }
    }
  }
}
```

Both configs are in `mcp/claude-desktop-config.json`.

## Cloud-Init Log

If the VM isn't ready after provisioning, check cloud-init progress:
```bash
tail -f /var/log/cloud-init-output.log
```

## Environment Variables

Set automatically in `/etc/profile.d/dax-env.sh`:

| Variable | Value |
|---|---|
| `DAX_REPO_PATH` | `/opt/dax` |
| `AZURE_SUBSCRIPTION` | `36676e89-8ccf-4390-8602-e57a913755dc` |
| `AZURE_RG` | `rg-dax-dakona-pilot` |
| `AZURE_CONTAINER_APP` | `ca-dax-dakona-pilot` |
| `N8N_URL` | `https://n8n.dakona.net` |
