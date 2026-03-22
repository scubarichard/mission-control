# DAX MCP Server

Model Context Protocol server for the DAX development workflow. Exposes tools for repo file operations, Git, Azure Container Apps, n8n workflow management, and Cosmos DB queries.

Supports two transports:
- **Stdio** (default) — for Claude Desktop / Claude Code local connections
- **HTTP/SSE** — for claude.ai remote MCP connections (e.g., `https://mcp.dakona.net`)

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

### Stdio mode (Claude Desktop / Claude Code)

```bash
cd mcp && node server.js
```

### SSE mode (claude.ai remote MCP)

```bash
cd mcp && MCP_TRANSPORT=sse node server.js
# or
npm run start:sse
```

The server listens on `0.0.0.0:3001` (override with `PORT` env var) and exposes:
- `GET /sse` — SSE event stream (claude.ai connects here)
- `POST /messages?sessionId=...` — JSON-RPC tool call endpoint
- `GET /health` — health check for Azure probes

A keepalive comment (`: keepalive`) is sent every 25 seconds to prevent Azure App Service / proxy idle timeouts from killing the SSE stream.

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
| `MCP_TRANSPORT` | `stdio` | Set to `sse` for HTTP/SSE mode (or pass `--sse` flag) |
| `PORT` | `3001` | HTTP port for SSE mode |
| `MCP_AUTH_TOKEN` | *(none)* | Bearer token for SSE mode auth (optional; claude.ai does not support custom tokens) |
| `CORS_ORIGINS` | *(none)* | Comma-separated additional origins to allow (claude.ai is always allowed) |

## Azure Deployment (SSE mode)

When deploying to Azure App Service or Container Apps for `https://mcp.dakona.net`:

1. **Set `MCP_TRANSPORT=sse`** in the app's environment variables
2. **Configure health probe** to `GET /health` on the app port
3. **Increase idle timeout**: Azure App Service defaults to 230 seconds. The keepalive pings (every 25s) prevent disconnects, but also set the App Service timeout to the maximum (30 minutes for Standard+):
   ```bash
   az webapp config set --name <app-name> --resource-group <rg> --generic-configurations '{"webSocketsEnabled": true}'
   ```
4. **For Container Apps**: Set `--min-replicas 1` to prevent cold starts
5. **Auth**: claude.ai remote MCPs work best with no auth or OAuth. If using a bearer token, set `MCP_AUTH_TOKEN` but note claude.ai may not support custom token auth
