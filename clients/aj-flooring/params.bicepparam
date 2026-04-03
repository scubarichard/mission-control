// AJ Flooring — live production deployment
using '../../infra/main.bicep'

param clientName = 'aj-flooring'
param location = 'eastus'
param openAiModelName = 'gpt-4o'
param openAiModelVersion = '2024-08-06'
param openAiCapacity = 30
param clientTenantId = '00000000-0000-0000-0000-000000000000'    // TODO: replace with AJ Flooring Entra tenant ID
param logRetentionDays = 1095                                    // SEC Rule 17a-4: minimum 3 years
param vnetAddressPrefix = '10.0.0.0/16'
