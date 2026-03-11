// Log Analytics workspace for audit trail and diagnostics
// Workspace-level retentionInDays sets interactive (hot) retention (max 730 days).
// Per-table archive retention (totalRetentionInDays up to 2555) cannot be set in Bicep —
// run scripts/Set-LogRetention.ps1 after deployment to configure SEC Rule 17a-4
// 6-year archive retention on all tables.

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
