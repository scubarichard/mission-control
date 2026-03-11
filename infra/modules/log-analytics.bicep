// Log Analytics workspace for audit trail and diagnostics
// TODO: SEC Rule 17a-4 long-term retention (6 years) will be handled via a Diagnostic
// Setting that exports logs to an Azure Storage Account with immutable blob storage
// (WORM policy). Log Analytics 90-day retention covers hot/queryable storage only.

param nameSuffix string
param location string
param tags object

@description('Interactive retention in days (hot storage). PerGB2018 SKU default.')
param retentionInDays int = 90

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'law-${nameSuffix}'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: min(retentionInDays, 730)
  }
}

output workspaceId string = workspace.id
output workspaceName string = workspace.name
