// ---------------------------------------------------------------------------
// Bing Search API v7 — enables web search grounding for DAX general queries
// ---------------------------------------------------------------------------

@description('Client short name (e.g. dakona-pilot)')
param clientName string

@description('Log Analytics workspace ID for diagnostics')
param logAnalyticsId string = ''

var bingName = 'bing-dax-${clientName}'

resource bingSearch 'Microsoft.Bing/accounts@2020-06-10' = {
  name: bingName
  location: 'global'
  kind: 'Bing.Search.v7'
  sku: {
    name: 'S1'
  }
}

@description('Bing Search resource name')
output name string = bingSearch.name

@description('Bing Search API endpoint')
output endpoint string = 'https://api.bing.microsoft.com/v7.0'

@description('Bing Search resource ID')
output resourceId string = bingSearch.id
