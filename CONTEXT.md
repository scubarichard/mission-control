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

### Important: Rerun Deploy-SSOConfig.ps1 after custom domain setup

After binding a custom domain, `Deploy-SSOConfig.ps1` **must be rerun** with the
new URL so that `DOMAIN_SERVER` and `DOMAIN_CLIENT` env vars update correctly.
Without this, SSO redirects will still point to the old Container Apps URL and
authentication will fail.

### Status

**dax.dakona.com is live and SSO is working.** The Entra app registration has
redirect URIs for both the raw Container Apps URL and the custom domain.

### Deployment Commands (dakona-pilot)

When running Deploy-EntraApp.ps1, pass both the Container Apps URL and custom domain:

```powershell
./scripts/Deploy-EntraApp.ps1 -ClientName dakona-pilot `
    -LibreChatUrl "https://ca-dax-dakona-pilot.icyplant-88ae76cd.eastus.azurecontainerapps.io" `
    -CustomDomainUrl "https://dax.dakona.com"
```

When running Deploy-SSOConfig.ps1, use the custom domain:

```powershell
./scripts/Deploy-SSOConfig.ps1 -ClientName dakona-pilot `
    -ClientTenantId "d2a3c346-00f3-47dd-a53e-caa3fca74714" `
    -LibreChatUrl "https://dax.dakona.com"
```

## TODO / Roadmap

### Client Onboarding — B2B Guest Access

For non-Dakona clients, users authenticate via Azure AD B2B:
- No changes required on client's existing tenant
- No new passwords for their staff
- Client IT/MSP has nothing to configure

Deployment steps (on DAX tenant side):
1. Add client domain to `librechat.yaml` `allowedDomains`
2. Run `az ad invitation create` for each user
3. Users receive email, click accept, log in with existing Microsoft creds

**Script needed:** `scripts/Invite-ClientUsers.ps1`
- Takes `-ClientName`, `-UserEmails` params
- Sends B2B invitations from DAX tenant
- Adds domain to `allowedDomains` in yaml
- Redeploys SSO config
