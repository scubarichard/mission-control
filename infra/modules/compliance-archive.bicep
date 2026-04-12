// Compliance Archive — SEC 17a-4 WORM storage for conversations and audit logs
// Immutable blob storage with time-based retention policy

param nameSuffix string
param location string
param logAnalyticsWorkspaceId string
param tags object

@description('Immutability retention period in days (SEC 17a-4: 2555 = 7 years).')
param retentionDays int = 2555

@description('Lock the immutability policy (cannot be shortened or removed once locked). Set to true for production compliance.')
param lockPolicy bool = false

// ---------- Storage Account ----------

var saRaw = replace('sadax${nameSuffix}', '-', '')
var storageAccountName = length(saRaw) > 24 ? substring(saRaw, 0, 24) : saRaw

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Cool'
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowSharedKeyAccess: false
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
    }
  }
}

// ---------- Blob Service ----------

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    isVersioningEnabled: true
    deleteRetentionPolicy: {
      enabled: true
      days: 365
    }
  }
}

// ---------- Conversations Archive Container (WORM) ----------

resource conversationsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'conversations'
  properties: {
    publicAccess: 'None'
    immutableStorageWithVersioning: {
      enabled: true
    }
  }
}

resource conversationsPolicy 'Microsoft.Storage/storageAccounts/blobServices/containers/immutabilityPolicies@2023-05-01' = {
  parent: conversationsContainer
  name: 'default'
  properties: {
    immutabilityPeriodSinceCreationInDays: retentionDays
    allowProtectedAppendWrites: true // Allow appending (audit trail) but not modifying
  }
}

// ---------- Audit Logs Archive Container (WORM) ----------

resource auditContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'audit-logs'
  properties: {
    publicAccess: 'None'
    immutableStorageWithVersioning: {
      enabled: true
    }
  }
}

resource auditPolicy 'Microsoft.Storage/storageAccounts/blobServices/containers/immutabilityPolicies@2023-05-01' = {
  parent: auditContainer
  name: 'default'
  properties: {
    immutabilityPeriodSinceCreationInDays: retentionDays
    allowProtectedAppendWrites: true
  }
}

// ---------- Log Analytics Data Export (audit logs → blob) ----------

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: last(split(logAnalyticsWorkspaceId, '/'))
}

resource dataExport 'Microsoft.OperationalInsights/workspaces/dataExports@2020-08-01' = {
  parent: logAnalytics
  name: 'compliance-archive'
  properties: {
    destination: {
      resourceId: storageAccount.id
    }
    tableNames: [
      'AppServiceHTTPLogs'
      'AppServiceConsoleLogs'
      'AzureDiagnostics'
      'AzureMetrics'
    ]
    enable: true
  }
}

// ---------- Diagnostic Settings ----------

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'archive-diagnostics'
  scope: storageAccount
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    metrics: [
      {
        category: 'Transaction'
        enabled: true
      }
    ]
  }
}

// ---------- Outputs ----------

output storageAccountName string = storageAccount.name
output storageAccountId string = storageAccount.id
output conversationsContainerName string = conversationsContainer.name
output auditContainerName string = auditContainer.name
