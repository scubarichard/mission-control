// Azure Lighthouse — delegate client subscription to Dakona managing tenant

targetScope = 'subscription'

@description('Display name shown in the client tenant.')
param registrationName string = 'Dakona - DAX Managed Services'

@description('Description of the delegation.')
param registrationDescription string = 'Enables Dakona to manage DAX AI Workspace resources in this subscription.'

@description('Dakona (managing) tenant ID.')
param managingTenantId string

@description('Authorizations: Dakona principals and their roles.')
param authorizations array
// Each item: { principalId, roleDefinitionId, principalIdDisplayName }

resource registrationDefinition 'Microsoft.ManagedServices/registrationDefinitions@2022-10-01' = {
  name: guid('dax-lighthouse-${managingTenantId}')
  properties: {
    registrationDefinitionName: registrationName
    description: registrationDescription
    managedByTenantId: managingTenantId
    authorizations: [
      for auth in authorizations: {
        principalId: auth.principalId
        roleDefinitionId: auth.roleDefinitionId
        principalIdDisplayName: auth.principalIdDisplayName
      }
    ]
  }
}

resource registrationAssignment 'Microsoft.ManagedServices/registrationAssignments@2022-10-01' = {
  name: guid('dax-lighthouse-assignment-${managingTenantId}')
  properties: {
    registrationDefinitionId: registrationDefinition.id
  }
}
