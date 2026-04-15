# Dakona MCP Server — claude.ai Configuration

## Remote MCP URL (claude.ai)

```
https://mcp.dakona.net/mcp?token=QuCpV4XodOJMyIP8JQf0dLeQhdeXHtghZ4pcgFFg
```

**Transport:** streamable-http  
**Auth:** token in query param (`?token=...`)  
**Container:** `ca-dax-mcp-dakona-pilot` (rg-dax-dakona-pilot, DAKONA 001)  
**Revision:** 0000028  

## How to add in claude.ai

Settings → Integrations → Add MCP server  
- **Name:** `mcp.dakona.net`  
- **URL:** paste the URL above (includes token)  

## Token

`MCP_AUTH_TOKEN` is hardcoded in the container app environment (not rotating from KV).  
Same value as `DESKTOP_BRIDGE_SECRET`.  
To rotate: update env var in `ca-dax-mcp-dakona-pilot` via `az containerapp update`.

## Troubleshooting

- `401` on `/mcp` = token missing from URL
- `400` on `/mcp?token=...` = auth OK, request format issue (expected for plain curl)
- Container status: `az containerapp show --name ca-dax-mcp-dakona-pilot --resource-group rg-dax-dakona-pilot --subscription "DAKONA 001" --query "properties.runningStatus"`

## Last verified working: 2026-04-15
