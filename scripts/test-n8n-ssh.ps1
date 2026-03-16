
# Test SSH connection to n8n VM and diagnose MCP server
param([string]$Command = "node --version")

$sshArgs = @(
    "-i", "C:/Users/18473/.ssh/id_rsa",
    "-o", "StrictHostKeyChecking=no",
    "-o", "ConnectTimeout=10",
    "dkn8n@n8n.dakona.net",
    $Command
)

$proc = New-Object System.Diagnostics.Process
$proc.StartInfo.FileName = "C:\Windows\System32\OpenSSH\ssh.exe"
$proc.StartInfo.Arguments = ($sshArgs | ForEach-Object { if ($_ -match ' ') { '"{0}"' -f $_ } else { $_ } }) -join " "
$proc.StartInfo.UseShellExecute = $false
$proc.StartInfo.RedirectStandardOutput = $true
$proc.StartInfo.RedirectStandardError = $true
$proc.StartInfo.CreateNoWindow = $true
$proc.Start() | Out-Null
$stdout = $proc.StandardOutput.ReadToEnd()
$stderr = $proc.StandardError.ReadToEnd()
$proc.WaitForExit(10000)

"=== SSH Test ==="
"Command: $Command"
"Exit: $($proc.ExitCode)"
"STDOUT: [$stdout]"
"STDERR: [$stderr]"
