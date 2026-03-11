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

# 2. Deploy Azure infrastructure
./scripts/Deploy-Infrastructure.ps1 -ClientName <name>

# 3. Register Entra ID app for SSO (stores secrets in KV + wires into Container App)
./scripts/Deploy-EntraApp.ps1 -ClientName <name> `
  -LibreChatUrl "https://ca-dax-<name>.<container-app-domain>"

# 4. Generate session secrets (stores in KV + wires into Container App)
./scripts/Deploy-LibreChatSecrets.ps1 -ClientName <name>

# 5. Apply Purview policies
./scripts/Deploy-PurviewPolicies.ps1 -ClientName <name> `
  -ClientTenantId <tenant-id> `
  -ComplianceAdminUpn <upn>
```

After step 3, grant admin consent for the Entra app API permissions in the Azure portal
(Entra ID > App registrations > DAX - Dakona AI Workspace > API permissions > Grant admin consent).

### Redeployment

Bicep can be safely redeployed without affecting script-managed secrets. Only the 2
Bicep-managed secrets (`openai-api-key`, `cosmos-connection-string`) are in the template.
The 6 script-managed secrets persist in Key Vault and on the Container App across
infrastructure redeployments.

### Prerequisites for scripts

Scripts that write to Key Vault (`Deploy-EntraApp.ps1`, `Deploy-LibreChatSecrets.ps1`)
use the data-plane API and require the **Key Vault Secrets Officer** role:

```powershell
az role assignment create \
  --assignee <your-principal-id> \
  --role "Key Vault Secrets Officer" \
  --scope /subscriptions/<sub>/resourceGroups/rg-dax-<name>/providers/Microsoft.KeyVault/vaults/<kv-name>
```
