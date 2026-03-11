// Cosmos DB with MongoDB API — serverless — for LibreChat conversation storage

param nameSuffix string
param location string
param keyVaultName string
param logAnalyticsWorkspaceId string
param tags object

@description('Database name.')
param databaseName string = 'librechat'

@description('Collection name.')
param collectionName string = 'conversations'

// ---------- Cosmos DB Account ----------

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: 'cosmos-${nameSuffix}'
  location: location
  tags: tags
  kind: 'MongoDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    apiProperties: {
      serverVersion: '4.2'
    }
    capabilities: [
      { name: 'EnableMongo' }
      { name: 'EnableServerless' }
    ]
    locations: [
      {
        locationName: location
        failoverPriority: 0
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    publicNetworkAccess: 'Disabled'
    minimalTlsVersion: 'Tls12'
  }
}

// ---------- Database ----------

resource database 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases@2024-05-15' = {
  parent: cosmosAccount
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
  }
}

// ---------- Collection ----------

resource collection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2024-05-15' = {
  parent: database
  name: collectionName
  properties: {
    resource: {
      id: collectionName
      indexes: [
        {
          key: { keys: ['_id'] }
        }
        {
          key: { keys: ['conversationId'] }
        }
        {
          key: { keys: ['user'] }
        }
      ]
    }
  }
}

// ---------- Store connection string in Key Vault ----------

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource cosmosConnectionString 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'cosmos-connection-string'
  properties: {
    value: cosmosAccount.listConnectionStrings().connectionStrings[0].connectionString
  }
}

// ---------- Diagnostics ----------

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'cosmos-diagnostics'
  scope: cosmosAccount
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
        category: 'Requests'
        enabled: true
      }
    ]
  }
}

output accountId string = cosmosAccount.id
output accountName string = cosmosAccount.name
output endpoint string = cosmosAccount.properties.documentEndpoint
