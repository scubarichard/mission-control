// AJ Flooring — RPE Systems client, live production deployment
// Note: Not Entra-enabled; no SSO/tenant integration
using '../../../infra/main.bicep'

param clientName = 'rpe-aj-flooring'
param location = 'eastus'
param openAiModelName = 'gpt-4o'
param openAiModelVersion = '2024-08-06'
param openAiCapacity = 30
param clientTenantId = ''                                        // Not Entra-enabled
param logRetentionDays = 1095                                    // SEC Rule 17a-4: minimum 3 years
param vnetAddressPrefix = '10.0.0.0/16'
