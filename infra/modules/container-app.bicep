// Azure Container Apps — hosts LibreChat

param nameSuffix string
param location string
param keyVaultName string
param openAiEndpoint string
param logAnalyticsWorkspaceId string
param clientTenantId string
param tags object

@description('Container Apps infrastructure subnet ID for VNet integration.')
param infrastructureSubnetId string

@description('LibreChat container image.')
param containerImage string = 'ghcr.io/danny-avila/librechat:latest'

@description('CPU cores for the container.')
param cpuCores string = '1.0'

@description('Memory in Gi for the container.')
param memorySize string = '2.0Gi'

// ---------- Log Analytics (for Container App Environment) ----------

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: last(split(logAnalyticsWorkspaceId, '/'))
}

// ---------- Managed Environment ----------

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-${nameSuffix}'
  location: location
  tags: tags
  properties: {
    vnetConfiguration: {
      infrastructureSubnetId: infrastructureSubnetId
      internal: false
    }
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// ---------- User-Assigned Managed Identity ----------

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${nameSuffix}'
  location: location
  tags: tags
}

// ---------- Key Vault access for the managed identity ----------

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// Key Vault Secrets User role
resource kvRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, identity.id, '4633458b-17de-408a-b874-0445c86b69e6')
  scope: keyVault
  properties: {
    principalId: identity.properties.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalType: 'ServicePrincipal'
  }
}

// ---------- Container App ----------

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-${nameSuffix}'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3080
        transport: 'http'
        allowInsecure: false
      }
      // Bicep-managed secrets only. Script-managed secrets (Entra, session)
      // are added by Deploy-EntraApp.ps1 and Deploy-LibreChatSecrets.ps1.
      secrets: [
        {
          name: 'openai-api-key'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/openai-api-key'
          identity: identity.id
        }
        {
          name: 'cosmos-connection-string'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/cosmos-connection-string'
          identity: identity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'librechat'
          image: containerImage
          resources: {
            cpu: json(cpuCores)
            memory: memorySize
          }
          env: [
            { name: 'HOST', value: '0.0.0.0' }
            { name: 'PORT', value: '3080' }
            { name: 'OPENAI_API_KEY', secretRef: 'openai-api-key' }
            { name: 'AZURE_OPENAI_API_INSTANCE_NAME', value: replace(replace(openAiEndpoint, 'https://', ''), '.openai.azure.com/', '') }
            { name: 'AZURE_API_VERSION', value: '2024-08-01-preview' }
            { name: 'AZURE_OPENAI_MODELS', value: 'gpt-4o' }
            { name: 'DOMAIN_CLIENT', value: 'https://ca-${nameSuffix}.${environment.properties.defaultDomain}' }
            { name: 'DOMAIN_SERVER', value: 'https://ca-${nameSuffix}.${environment.properties.defaultDomain}' }
            { name: 'OPENID_ISSUER', value: '${az.environment().authentication.loginEndpoint}${clientTenantId}/v2.0' }
            { name: 'OPENID_SCOPE', value: 'openid profile email' }
            { name: 'OPENID_CALLBACK_URL', value: '/oauth/openid/callback' }
            { name: 'OPENID_BUTTON_LABEL', value: 'Sign in with Microsoft' }
            { name: 'ALLOW_SOCIAL_LOGIN', value: 'true' }
            { name: 'ALLOW_SOCIAL_REGISTRATION', value: 'true' }
            { name: 'MONGO_URI', secretRef: 'cosmos-connection-string' }
            // OPENID_CLIENT_ID, OPENID_CLIENT_SECRET → added by Deploy-EntraApp.ps1
            // JWT_SECRET, JWT_REFRESH_SECRET, CREDS_KEY, CREDS_IV → added by Deploy-LibreChatSecrets.ps1
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

output fqdn string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output identityPrincipalId string = identity.properties.principalId
