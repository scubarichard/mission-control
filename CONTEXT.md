# DAX Deployment Context

## Custom Domain — dakona-pilot

The `dakona-pilot` deployment uses the custom domain **dax.dakona.com**.

**DAX URL:** https://dax.dakona.com

### DNS Configuration (GoDaddy — dakona.com)

| Type  | Name       | Value |
|-------|------------|-------|
| TXT   | asuid.dax  | `60BE6AD3B61C314CD4A166BDA739CDE721EF3DC7F898054F596D7533805D9BDD` |
| CNAME | dax        | `ca-dax-dakona-pilot.icyplant-88ae76cd.eastus.azurecontainerapps.io` |

### Custom Domain Setup (after infrastructure deployment)

After deploying the Container App, bind the custom domain:

```powershell
# 1. Add the hostname
az containerapp hostname add `
    --name ca-dax-dakona-pilot `
    --resource-group rg-dax-dakona-pilot `
    --hostname dax.dakona.com

# 2. Bind with a managed certificate
az containerapp hostname bind `
    --name ca-dax-dakona-pilot `
    --resource-group rg-dax-dakona-pilot `
    --hostname dax.dakona.com `
    --environment managedEnvironment-dax-dakona-pilot `
    --validation-method CNAME
```

### Deployment Commands (dakona-pilot)

When running Deploy-EntraApp.ps1 or Deploy-SSOConfig.ps1, use the custom domain:

```powershell
./scripts/Deploy-SSOConfig.ps1 -ClientName dakona-pilot `
    -ClientTenantId "d2a3c346-00f3-47dd-a53e-caa3fca74714" `
    -LibreChatUrl "https://dax.dakona.com"
```
