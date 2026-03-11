// DAX — Dakona AI Workspace
// Main orchestration template — deploys all modules into a client tenant

targetScope = 'subscription'

// ============================================================================
// Parameters
// ============================================================================

@description('Client short name (lowercase, no spaces). Used in resource naming.')
param clientName string

@description('Azure region for all resources.')
param location string = 'eastus'

@description('Azure OpenAI model deployment name.')
param openAiModelName string = 'gpt-4o'

@description('Azure OpenAI model version.')
param openAiModelVersion string = '2024-08-06'

@description('Azure OpenAI capacity (thousands of tokens per minute).')
param openAiCapacity int = 30

@description('Entra ID tenant ID for the client.')
param clientTenantId string

@description('Log and audit retention in days. SEC Rule 17a-4 requires minimum 3 years (1095 days) for RIA firms.')
param logRetentionDays int = 1095

@description('VNet address space (CIDR).')
param vnetAddressPrefix string = '10.0.0.0/16'

@description('Tags applied to all resources.')
param tags object = {
  product: 'dax'
  client: clientName
  managedBy: 'dakona'
}

// ============================================================================
// Variables
// ============================================================================

var resourceGroupName = 'rg-dax-${clientName}'
var nameSuffix = 'dax-${clientName}'

// ============================================================================
// Resource Group
// ============================================================================

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

// ============================================================================
// Modules
// ============================================================================

module logAnalytics 'modules/log-analytics.bicep' = {
  name: 'logAnalytics'
  scope: rg
  params: {
    nameSuffix: nameSuffix
    location: location
    retentionInDays: logRetentionDays
    tags: tags
  }
}

module keyVault 'modules/key-vault.bicep' = {
  name: 'keyVault'
  scope: rg
  params: {
    nameSuffix: nameSuffix
    location: location
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
    softDeleteRetentionInDays: logRetentionDays
    tags: tags
  }
}

module openAi 'modules/openai.bicep' = {
  name: 'openAi'
  scope: rg
  params: {
    nameSuffix: nameSuffix
    location: location
    modelName: openAiModelName
    modelVersion: openAiModelVersion
    capacity: openAiCapacity
    keyVaultName: keyVault.outputs.keyVaultName
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
    tags: tags
  }
}

module cosmos 'modules/cosmos.bicep' = {
  name: 'cosmos'
  scope: rg
  params: {
    nameSuffix: nameSuffix
    location: location
    keyVaultName: keyVault.outputs.keyVaultName
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
    tags: tags
  }
}

module vnet 'modules/vnet.bicep' = {
  name: 'vnet'
  scope: rg
  params: {
    nameSuffix: nameSuffix
    location: location
    vnetAddressPrefix: vnetAddressPrefix
    openAiAccountId: openAi.outputs.accountId
    cosmosAccountId: cosmos.outputs.accountId
    tags: tags
  }
}

module containerApp 'modules/container-app.bicep' = {
  name: 'containerApp'
  scope: rg
  dependsOn: [vnet]
  params: {
    nameSuffix: nameSuffix
    location: location
    keyVaultName: keyVault.outputs.keyVaultName
    openAiEndpoint: openAi.outputs.endpoint
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
    clientTenantId: clientTenantId
    infrastructureSubnetId: vnet.outputs.containerAppsSubnetId
    tags: tags
  }
}

// ============================================================================
// Outputs
// ============================================================================

output resourceGroupName string = rg.name
output libreChatUrl string = containerApp.outputs.fqdn
output openAiEndpoint string = openAi.outputs.endpoint
output keyVaultName string = keyVault.outputs.keyVaultName
output logAnalyticsWorkspaceId string = logAnalytics.outputs.workspaceId
