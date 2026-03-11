# DAX — Dakona AI Workspace

Managed AI workspace for RIA (Registered Investment Advisor) clients. Deploys into each client's Azure tenant and provides a governed AI workspace.

## Architecture

| Component | Purpose |
|---|---|
| Azure OpenAI (GPT-4o) | LLM backend |
| LibreChat | Chat UI (Azure Container Apps) |
| Entra ID | SSO / authentication |
| Key Vault | Secrets management |
| Log Analytics | Audit trail |
| Microsoft Purview | DLP & Communication Compliance |
| Azure Lighthouse | Cross-tenant management from Dakona |

## Repo Structure

```
infra/              Bicep templates for Azure resources
  modules/          Reusable Bicep modules
librechat/          LibreChat configuration & Dockerfile
scripts/            PowerShell deployment & Purview policy scripts
clients/            Per-client parameter files
docs/               Architecture diagrams & runbooks
```

## Deployment

```powershell
# 1. Onboard client tenant via Lighthouse
./scripts/Deploy-Lighthouse.ps1 -ClientName <name> `
  -ClientSubscriptionId <sub-id> `
  -DakonaTenantId <dakona-tenant-id> `
  -DakonaPrincipalId <dakona-principal-id>

# 2. Deploy Azure infrastructure (all resources + seed secrets)
az deployment sub create \
  --location eastus \
  --template-file infra/main.bicep \
  --parameters @clients/<client>/params.bicepparam

# 3. Generate production session secrets
./scripts/Deploy-LibreChatSecrets.ps1 -ClientName <name>

# 4. Register Entra ID app for SSO
./scripts/Deploy-EntraApp.ps1 -ClientName <name> `
  -LibreChatUrl "https://ca-dax-<name>.<container-app-domain>"

# 5. Restart Container App to pick up updated secrets
az containerapp revision restart \
  -n ca-dax-<name> -g rg-dax-<name> --revision <active-revision>

# 6. Grant admin consent for Entra app API permissions (Azure Portal)

# 7. Apply Purview policies
./scripts/Deploy-PurviewPolicies.ps1 -ClientName <name> `
  -ClientTenantId <tenant-id> `
  -ComplianceAdminUpn <upn>
```

### Prerequisites for scripts

Scripts that write to Key Vault (`Deploy-LibreChatSecrets.ps1`, `Deploy-EntraApp.ps1`)
use the data-plane API and require the **Key Vault Secrets Officer** role:

```powershell
az role assignment create \
  --assignee <your-principal-id> \
  --role "Key Vault Secrets Officer" \
  --scope /subscriptions/<sub>/resourceGroups/rg-dax-<name>/providers/Microsoft.KeyVault/vaults/<kv-name>
```
