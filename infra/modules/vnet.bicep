// VNet with subnets, private DNS zones, and private endpoints

param nameSuffix string
param location string
param tags object

@description('VNet address space.')
param vnetAddressPrefix string = '10.0.0.0/16'

@description('Container Apps infrastructure subnet (min /23).')
param containerAppsSubnetPrefix string = '10.0.0.0/23'

@description('Private endpoints subnet.')
param privateEndpointsSubnetPrefix string = '10.0.2.0/24'

@description('Azure OpenAI account resource ID for private endpoint.')
param openAiAccountId string

@description('Cosmos DB account resource ID for private endpoint.')
param cosmosAccountId string

// ============================================================================
// VNet
// ============================================================================

resource vnet 'Microsoft.Network/virtualNetworks@2024-01-01' = {
  name: 'vnet-${nameSuffix}'
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [vnetAddressPrefix]
    }
    subnets: [
      {
        name: 'snet-container-apps'
        properties: {
          addressPrefix: containerAppsSubnetPrefix
          delegations: [
            {
              name: 'container-apps'
              properties: {
                serviceName: 'Microsoft.App/environments'
              }
            }
          ]
        }
      }
      {
        name: 'snet-private-endpoints'
        properties: {
          addressPrefix: privateEndpointsSubnetPrefix
        }
      }
    ]
  }
}

// ============================================================================
// Private DNS Zones
// ============================================================================

resource dnsZoneOpenAi 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'privatelink.openai.azure.com'
  location: 'global'
  tags: tags
}

resource dnsZoneCosmos 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'privatelink.mongo.cosmos.azure.com'
  location: 'global'
  tags: tags
}

// ---------- VNet Links ----------

resource dnsLinkOpenAi 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: dnsZoneOpenAi
  name: 'link-${nameSuffix}'
  location: 'global'
  tags: tags
  properties: {
    virtualNetwork: {
      id: vnet.id
    }
    registrationEnabled: false
  }
}

resource dnsLinkCosmos 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: dnsZoneCosmos
  name: 'link-${nameSuffix}'
  location: 'global'
  tags: tags
  properties: {
    virtualNetwork: {
      id: vnet.id
    }
    registrationEnabled: false
  }
}

// ============================================================================
// Private Endpoints
// ============================================================================

var peSubnetId = vnet.properties.subnets[1].id

// ---------- Azure OpenAI ----------

resource peOpenAi 'Microsoft.Network/privateEndpoints@2024-01-01' = {
  name: 'pe-oai-${nameSuffix}'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: peSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: 'oai-connection'
        properties: {
          privateLinkServiceId: openAiAccountId
          groupIds: ['account']
        }
      }
    ]
  }
}

resource peOpenAiDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-01-01' = {
  parent: peOpenAi
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'openai'
        properties: {
          privateDnsZoneId: dnsZoneOpenAi.id
        }
      }
    ]
  }
}

// ---------- Cosmos DB ----------

resource peCosmos 'Microsoft.Network/privateEndpoints@2024-01-01' = {
  name: 'pe-cosmos-${nameSuffix}'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: peSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: 'cosmos-connection'
        properties: {
          privateLinkServiceId: cosmosAccountId
          groupIds: ['MongoDB']
        }
      }
    ]
  }
}

resource peCosmosDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-01-01' = {
  parent: peCosmos
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'cosmos'
        properties: {
          privateDnsZoneId: dnsZoneCosmos.id
        }
      }
    ]
  }
}

// ============================================================================
// Outputs
// ============================================================================

output vnetId string = vnet.id
output containerAppsSubnetId string = vnet.properties.subnets[0].id
output privateEndpointsSubnetId string = peSubnetId
