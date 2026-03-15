# DAX MCP Server

Model Context Protocol server for the DAX development workflow. Exposes tools for repo file operations, Git, Azure Container Apps, n8n workflow management, and Cosmos DB queries via stdio transport.

## Prerequisites

- Node.js 18+
- Azure CLI (`az`) logged in with access to the DAX subscription
- Git configured with push access to the repo
- PowerShell (for `run_powershell` and `deploy_sso_config` tools)

## Install

```bash
cd mcp
npm install
```

## Add to Claude Desktop

Copy the contents of `claude-desktop-config.json` into your Claude Desktop configuration file:

- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

Merge the `mcpServers` object if you already have other MCP servers configured.

## Start manually

```powershell
.\scripts\Start-MCPServer.ps1
```

Or directly:

```bash
cd mcp && node server.js
```

## Tools

| Tool | Description |
|------|-------------|
| `read_file` | Read any file in the DAX repo (relative path) |
| `write_file` | Write or update a file, creating directories as needed |
| `run_powershell` | Execute an arbitrary PowerShell command (120s timeout) |
| `git_status` | Show `git status` of the repo |
| `git_commit_push` | Stage all changes, commit with a message, and push |
| `azure_container_logs` | Fetch recent Azure Container App logs with optional filter |
| `azure_revision` | List active Container App revisions |
| `deploy_sso_config` | Run `Deploy-SSOConfig.ps1` for dakona-pilot |
| `n8n_list_workflows` | List all n8n workflows via the REST API |
| `cosmos_query` | Query a Cosmos DB (MongoDB API) collection |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DAX_REPO_PATH` | `P:/_clients/dakona/dax` | Absolute path to the DAX repo root |
| `AZURE_SUBSCRIPTION` | *(required for Azure tools)* | Azure subscription ID |
| `AZURE_RG` | `rg-dax-dakona-pilot` | Azure resource group name |
| `AZURE_CONTAINER_APP` | `ca-dax-dakona-pilot` | Azure Container App name |
| `N8N_URL` | `https://n8n.dakona.net` | Base URL of the n8n instance |
| `MONGO_URI` | *(optional)* | MongoDB connection string for Cosmos DB; if not set, `cosmos_query` attempts to read it from Azure Key Vault |
