targetScope = 'subscription'

@description('The Azure Developer CLI environment name.')
@minLength(1)
param environmentName string

@description('The Azure region for the resource group and Static Web App.')
param location string

@description('The name of the Static Web App.')
param staticWebAppName string = 'mr-minecrafts-coding-app'

var resourceGroupName = 'rg-${environmentName}'
var tags = {
  'azd-env-name': environmentName
}

resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

module staticWebApp 'br/public:avm/res/web/static-site:0.9.0' = {
  scope: resourceGroup
  params: {
    name: staticWebAppName
    location: location
    sku: 'Free'
    stagingEnvironmentPolicy: 'Enabled'
    tags: union(tags, {
      'azd-service-name': 'web'
    })
  }
}

output AZURE_LOCATION string = location
output AZURE_RESOURCE_GROUP string = resourceGroup.name
output SERVICE_WEB_NAME string = staticWebApp.outputs.name
output SERVICE_WEB_URI string = 'https://${staticWebApp.outputs.defaultHostname}'