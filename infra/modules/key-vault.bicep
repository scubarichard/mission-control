// Key Vault for secrets (OpenAI keys, LibreChat credentials)

param nameSuffix string
param location string
param logAnalyticsWorkspaceId string
param tags object

@description('Soft-delete retention in days. Capped at 90 by Azure; audit retention is handled by Log Analytics.')
param softDeleteRetentionInDays int = 90

// Key Vault names: 3-24 alphanumeric chars, globally unique
var kvName = replace('kv-${nameSuffix}', '-', '')

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: length(kvName) > 24 ? substring(kvName, 0, 24) : kvName
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: tenant().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: min(softDeleteRetentionInDays, 90)
    enablePurgeProtection: true
  }
}

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'kv-diagnostics'
  scope: keyVault
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        categoryGroup: 'audit'
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

// Script-managed secrets (NOT in Bicep — avoids overwrite on redeploy):
// Deploy-EntraApp.ps1       → entra-client-id, entra-client-secret
// Deploy-LibreChatSecrets.ps1 → jwt-secret, jwt-refresh-secret, creds-key, creds-iv
// These scripts also wire their secrets into the Container App.

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
