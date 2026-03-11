// Key Vault for secrets (OpenAI keys, LibreChat credentials)

param nameSuffix string
param location string
param logAnalyticsWorkspaceId string
param tags object

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
    softDeleteRetentionInDays: 90
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

// ---------- Seed secrets ----------
// Deterministic seed values ensure Bicep deploys cleanly on first run.
// Deploy-LibreChatSecrets.ps1 replaces session secrets with crypto-random values.
// Deploy-EntraApp.ps1 replaces Entra placeholders with real credentials.

resource jwtSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'jwt-secret'
  properties: {
    value: guid(nameSuffix, 'jwt-secret')
  }
}

resource jwtRefreshSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'jwt-refresh-secret'
  properties: {
    value: guid(nameSuffix, 'jwt-refresh-secret')
  }
}

resource credsKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'creds-key'
  properties: {
    value: replace(guid(nameSuffix, 'creds-key'), '-', '')
  }
}

resource credsIv 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'creds-iv'
  properties: {
    value: substring(replace(guid(nameSuffix, 'creds-iv'), '-', ''), 0, 16)
  }
}

resource entraClientId 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'entra-client-id'
  properties: {
    value: 'placeholder-run-Deploy-EntraApp'
  }
}

resource entraClientSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'entra-client-secret'
  properties: {
    value: 'placeholder-run-Deploy-EntraApp'
  }
}

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
