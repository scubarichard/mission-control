// Dakona pilot tenant — internal validation deployment
using '../../infra/main.bicep'

param clientName = 'dakona-pilot'
param location = 'eastus'
param openAiModelName = 'gpt-4o'
param openAiModelVersion = '2024-08-06'
param openAiCapacity = 30
param clientTenantId = 'd2a3c346-00f3-47dd-a53e-caa3fca74714'            // TODO: replace with Dakona Entra tenant ID
param logRetentionDays = 730                                     // PerGB2018 SKU max; long-term retention via Storage Account WORM
param vnetAddressPrefix = '10.0.0.0/16'
