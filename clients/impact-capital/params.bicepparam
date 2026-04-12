// Impact Capital Partners — first DAX client deployment
using '../../infra/main.bicep'

param clientName = 'impact-capital'
param location = 'eastus'
param openAiModelName = 'gpt-4o'
param openAiModelVersion = '2024-11-20'
param openAiCapacity = 30
param clientTenantId = 'eaf1a864-97ff-451c-87e7-88cf7512e98c'
param logRetentionDays = 1095                                    // SEC Rule 17a-4: minimum 3 years
param vnetAddressPrefix = '10.0.0.0/16'
param graphSiteId = 'impactcapitalpartnersllc.sharepoint.com,9408138e-0aa3-404e-b131-bc905b2d99d0,40e05979-6387-4bb6-8b8e-6638aa9c1e2f'
