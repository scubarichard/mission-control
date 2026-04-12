// Azure App Service — hosts n8n workflow engine per client
// Web App for Containers running n8nio/n8n with persistent /home storage
// VNet-integrated (outbound) + private endpoint (inbound) — no public access

param nameSuffix string
param location string
param keyVaultName string
param logAnalyticsWorkspaceId string
param tags object

@description('Subnet ID for App Service VNet integration (outbound traffic).')
param appServiceSubnetId string

@description('Subnet ID for private endpoint (inbound traffic from Container Apps).')
param privateEndpointSubnetId string

@description('VNet ID for private DNS zone link.')
param vnetId string

@description('User-assigned managed identity resource ID (shared with LibreChat Container App).')
param identityId string

@description('User-assigned managed identity principal ID for RBAC assignments.')
param identityPrincipalId string

@description('Client Entra tenant ID for Graph API auth.')
param graphTenantId string

@description('SharePoint site ID for document operations.')
param graphSiteId string

@description('n8n admin email for initial setup.')
@secure()
param n8nAdminEmail string = ''

@description('n8n admin password for initial setup.')
@secure()
param n8nAdminPassword string = ''

@description('App Service Plan SKU.')
param skuName string = 'B1'

// ---------- App Service Plan ----------

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: 'asp-n8n-${nameSuffix}'
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: skuName
  }
  properties: {
    reserved: true // Required for Linux
  }
}

// ---------- Key Vault access for the managed identity ----------

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// Key Vault Secrets User role for n8n to read secrets via @Microsoft.KeyVault() references
resource kvRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, identityId, '4633458b-17de-408a-b874-0445c86b69e6', 'n8n')
  scope: keyVault
  properties: {
    principalId: identityPrincipalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalType: 'ServicePrincipal'
  }
}

// ---------- Web App (n8n) ----------

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: 'app-n8n-${nameSuffix}'
  location: location
  tags: tags
  kind: 'app,linux,container'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    serverFarmId: appServicePlan.id
    virtualNetworkSubnetId: appServiceSubnetId
    httpsOnly: true
    keyVaultReferenceIdentity: identityId
    siteConfig: {
      linuxFxVersion: 'DOCKER|n8nio/n8n:latest'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      vnetRouteAllEnabled: true // Route all outbound traffic through VNet
      appSettings: [
        // n8n core
        { name: 'WEBSITES_PORT', value: '5678' }
        { name: 'N8N_PROTOCOL', value: 'https' }
        { name: 'N8N_PORT', value: '5678' }
        { name: 'N8N_PUSH_BACKEND', value: 'websocket' }
        { name: 'N8N_RUNNERS_ENABLED', value: 'true' }
        { name: 'GENERIC_TIMEZONE', value: 'America/New_York' }

        // Database — SQLite on persistent /home storage
        { name: 'DB_TYPE', value: 'sqlite' }
        { name: 'DB_SQLITE_DATABASE', value: '/home/n8n-data/database.sqlite' }
        { name: 'N8N_USER_FOLDER', value: '/home/n8n-data' }

        // Node.js sandbox permissions — required for document generation (PizZip subprocess)
        { name: 'N8N_BLOCK_ENV_ACCESS_IN_NODE', value: 'false' }
        { name: 'NODE_FUNCTION_ALLOW_BUILTIN', value: 'child_process,fs,path' }
        { name: 'NODE_FUNCTION_ALLOW_EXTERNAL', value: 'docx,pizzip' }

        // Graph API credentials (Key Vault references — resolved at runtime)
        { name: 'GRAPH_TENANT_ID', value: graphTenantId }
        { name: 'GRAPH_SITE_ID', value: graphSiteId }
        { name: 'GRAPH_CLIENT_ID', value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=docgen-client-id)' }
        { name: 'GRAPH_CLIENT_SECRET', value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=docgen-client-secret)' }

        // Azure OpenAI (for AI Agent workflows)
        { name: 'OPENAI_API_KEY', value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=openai-api-key)' }

        // n8n initial admin (for automated setup — remove after first login)
        { name: 'N8N_DEFAULT_ADMIN_EMAIL', value: n8nAdminEmail }
        { name: 'N8N_DEFAULT_ADMIN_PASSWORD', value: n8nAdminPassword }
      ]
    }
  }
}

// Disable public network access — only reachable via private endpoint
resource webAppPublicAccess 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: webApp
  name: 'web'
  properties: {
    publicNetworkAccess: 'Disabled'
  }
}

// ---------- Private Endpoint (inbound from VNet only) ----------

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2024-01-01' = {
  name: 'pe-n8n-${nameSuffix}'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: privateEndpointSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: 'n8n-connection'
        properties: {
          privateLinkServiceId: webApp.id
          groupIds: ['sites']
        }
      }
    ]
  }
}

// ---------- Private DNS Zone ----------

resource dnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'privatelink.azurewebsites.net'
  location: 'global'
  tags: tags
}

resource dnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: dnsZone
  name: 'link-n8n-${nameSuffix}'
  location: 'global'
  tags: tags
  properties: {
    virtualNetwork: {
      id: vnetId
    }
    registrationEnabled: false
  }
}

resource dnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-01-01' = {
  parent: privateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'n8n'
        properties: {
          privateDnsZoneId: dnsZone.id
        }
      }
    ]
  }
}

// ---------- Diagnostic Settings ----------

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'n8n-diagnostics'
  scope: webApp
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'AppServiceHTTPLogs'
        enabled: true
      }
      {
        category: 'AppServiceConsoleLogs'
        enabled: true
      }
      {
        category: 'AppServiceAppLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

// ---------- Outputs ----------

output appServicePlanId string = appServicePlan.id
output webAppName string = webApp.name
output webAppDefaultHostname string = webApp.properties.defaultHostName
output privateEndpointIp string = privateEndpoint.properties.customDnsConfigs[0].ipAddresses[0]
