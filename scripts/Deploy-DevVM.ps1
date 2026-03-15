<#
.SYNOPSIS
    Provisions a DAX development VM with MCP server in Azure.

.DESCRIPTION
    Creates an Ubuntu 22.04 VM (Standard_B1s) in the existing dk-n8n_group
    resource group. The VM has no public IP and uses SSH key authentication.
    Cloud-init installs Node.js 20, Azure CLI, PM2, clones the DAX repo,
    and starts the MCP server.

    The VM gets a system-assigned managed identity with Contributor
    role on rg-dax-dakona-pilot for Azure CLI operations.

.PARAMETER VMName
    Name of the VM. Defaults to vm-dax-dev.

.PARAMETER AdminUsername
    SSH admin username. Defaults to daxadmin.

.PARAMETER SshKeyPath
    Path to SSH public key. Defaults to ~/.ssh/id_rsa.pub.

.EXAMPLE
    ./Deploy-DevVM.ps1
    ./Deploy-DevVM.ps1 -VMName vm-dax-dev-2 -AdminUsername azureuser
#>

[CmdletBinding()]
param(
    [string] $VMName = "vm-dax-dev",
    [string] $AdminUsername = "daxadmin",
    [string] $SshKeyPath = "$HOME/.ssh/id_rsa.pub"
)

$ErrorActionPreference = 'Stop'

$subscriptionId = "36676e89-8ccf-4390-8602-e57a913755dc"
$rgName         = "dk-n8n_group"
$location       = "eastus"
$vnetName       = "vnet-eastus"
$subnetName     = "snet-eastus-1"
$vmSize         = "Standard_B1s"
$imageUrn       = "Canonical:0001-com-ubuntu-server-jammy:22_04-lts-gen2:latest"
$daxRg          = "rg-dax-dakona-pilot"

Write-Host "=== Deploy DAX Dev VM ===" -ForegroundColor Cyan
Write-Host "Subscription:   $subscriptionId"
Write-Host "Resource Group: $rgName"
Write-Host "VM Name:        $VMName"
Write-Host "VM Size:        $vmSize"
Write-Host "VNet/Subnet:    $vnetName / $subnetName"
Write-Host "Admin User:     $AdminUsername"
Write-Host ""

# Verify SSH key exists
if (-not (Test-Path $SshKeyPath)) {
    Write-Error "SSH public key not found at $SshKeyPath. Generate one with: ssh-keygen -t rsa -b 4096"
    return
}

# ============================================================================
# 1. Set subscription
# ============================================================================

Write-Host "Setting subscription..." -ForegroundColor Yellow
az account set --subscription $subscriptionId

# ============================================================================
# 2. Get subnet ID
# ============================================================================

Write-Host "Looking up subnet..." -ForegroundColor Yellow
$subnetId = az network vnet subnet show `
    --resource-group $rgName `
    --vnet-name $vnetName `
    --name $subnetName `
    --query "id" -o tsv

if (-not $subnetId) {
    Write-Error "Subnet $subnetName not found in VNet $vnetName"
    return
}
Write-Host "  Subnet ID: $($subnetId.Substring(0, 60))..."

# ============================================================================
# 3. Write cloud-init file
# ============================================================================

Write-Host "Generating cloud-init config..." -ForegroundColor Yellow

$cloudInit = @'
#cloud-config
package_update: true
package_upgrade: true

packages:
  - git
  - curl
  - ca-certificates
  - gnupg

runcmd:
  # Node.js 20 LTS via NodeSource
  - curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  - apt-get install -y nodejs

  # Azure CLI
  - curl -sL https://aka.ms/InstallAzureCLIDeb | bash

  # PM2
  - npm install -g pm2

  # Clone DAX repo
  - git clone https://github.com/scubarichard/dax.git /opt/dax
  - chown -R __ADMIN__:__ADMIN__ /opt/dax

  # Install MCP server dependencies
  - cd /opt/dax/mcp && npm install

  # Start MCP server via PM2 (as admin user)
  - su - __ADMIN__ -c "cd /opt/dax/mcp && pm2 start server.js --name dax-mcp"
  - su - __ADMIN__ -c "pm2 save"
  - env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u __ADMIN__ --hp /home/__ADMIN__

  # Set environment variables for the MCP server
  - |
    cat > /etc/profile.d/dax-env.sh << 'ENVEOF'
    export DAX_REPO_PATH=/opt/dax
    export AZURE_SUBSCRIPTION=36676e89-8ccf-4390-8602-e57a913755dc
    export AZURE_RG=rg-dax-dakona-pilot
    export AZURE_CONTAINER_APP=ca-dax-dakona-pilot
    export N8N_URL=https://n8n.dakona.net
    ENVEOF
  - chmod +x /etc/profile.d/dax-env.sh
'@

$cloudInit = $cloudInit -replace '__ADMIN__', $AdminUsername

$cloudInitPath = [System.IO.Path]::GetTempFileName()
Set-Content -Path $cloudInitPath -Value $cloudInit -Encoding UTF8
Write-Host "  cloud-init written to $cloudInitPath"

# ============================================================================
# 4. Create VM
# ============================================================================

Write-Host "`nCreating VM $VMName..." -ForegroundColor Yellow
Write-Host "  Image: Ubuntu 22.04 LTS"
Write-Host "  Size:  $vmSize (1 vCPU, 1 GiB RAM)"
Write-Host "  This may take 2-3 minutes..."

az vm create `
    --resource-group $rgName `
    --name $VMName `
    --location $location `
    --image $imageUrn `
    --size $vmSize `
    --admin-username $AdminUsername `
    --ssh-key-values $SshKeyPath `
    --subnet $subnetId `
    --public-ip-address '""' `
    --nsg '""' `
    --assign-identity '[system]' `
    --custom-data $cloudInitPath `
    --storage-sku StandardSSD_LRS `
    --os-disk-size-gb 30 `
    -o none

Remove-Item $cloudInitPath -Force

if ($LASTEXITCODE -ne 0) {
    Write-Error "VM creation failed"
    return
}

Write-Host "  VM created." -ForegroundColor Green

# ============================================================================
# 5. Get VM private IP and managed identity
# ============================================================================

$privateIp = az vm show `
    --resource-group $rgName `
    --name $VMName `
    --show-details `
    --query "privateIps" -o tsv

$identityPrincipalId = az vm show `
    --resource-group $rgName `
    --name $VMName `
    --query "identity.principalId" -o tsv

Write-Host "  Private IP: $privateIp"
Write-Host "  Identity:   $identityPrincipalId"

# ============================================================================
# 6. Assign Contributor role on rg-dax-dakona-pilot
# ============================================================================

Write-Host "`nAssigning Contributor role on $daxRg..." -ForegroundColor Yellow

$daxRgId = az group show --name $daxRg --query "id" -o tsv

az role assignment create `
    --assignee-object-id $identityPrincipalId `
    --assignee-principal-type ServicePrincipal `
    --role "Contributor" `
    --scope $daxRgId `
    -o none

Write-Host "  Contributor role assigned." -ForegroundColor Green

# ============================================================================
# 7. Summary
# ============================================================================

Write-Host "`n=== DAX Dev VM Ready ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "VM:          $VMName"
Write-Host "Private IP:  $privateIp"
Write-Host "Username:    $AdminUsername"
Write-Host "OS:          Ubuntu 22.04 LTS"
Write-Host "Managed ID:  Contributor on $daxRg"
Write-Host ""
Write-Host "Connect via SSH (from jumpbox or Bastion):" -ForegroundColor Yellow
Write-Host "  ssh $AdminUsername@$privateIp"
Write-Host ""
Write-Host "Connect Claude Desktop via SSH tunnel:" -ForegroundColor Yellow
Write-Host "  ssh -L 3100:localhost:3100 $AdminUsername@$privateIp"
Write-Host "  Then use the vm-ssh MCP config in claude-desktop-config.json"
Write-Host ""
Write-Host "Cloud-init is running in the background." -ForegroundColor DarkYellow
Write-Host "Check progress: ssh in and run: tail -f /var/log/cloud-init-output.log"
Write-Host ""
