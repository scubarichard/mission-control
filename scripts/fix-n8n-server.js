/**
 * Fixes the n8n MCP server.js via SSH using Node's spawn with stdio pipe
 * Run: node scripts/fix-n8n-server.js
 */
const { spawn } = require('child_process');

const pythonCode = `
import sys
with open('/home/dkn8n/mcp/server.js', 'r') as f:
    content = f.read()

print('Lines:', content.count('\\n'))
print('Last 150 chars:', repr(content[-150:]))

old = 'main().catch(e => { process.stderr.write(e.message + "\\\\n"); process.exit(1); });'
new_code = 'process.stdin.resume();\\nmain().catch(e => { process.stderr.write(e.message + "\\\\n"); process.exit(1); });'

if old in content:
    content = content.replace(old, new_code)
    with open('/home/dkn8n/mcp/server.js', 'w') as f:
        f.write(content)
    print('FIXED: added process.stdin.resume()')
else:
    print('Pattern not found - checking for stdin.resume already present:')
    print('Has stdin.resume:', 'stdin.resume' in content)
`;

const ssh = spawn('C:\\Windows\\System32\\OpenSSH\\ssh.exe', [
    '-T',
    '-i', 'C:/Users/18473/.ssh/id_rsa',
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ConnectTimeout=15',
    'dkn8n@n8n.dakona.net',
    'python3 -'
], { stdio: ['pipe', 'pipe', 'pipe'] });

let stdout = '';
let stderr = '';

ssh.stdout.on('data', d => { stdout += d; process.stdout.write(d); });
ssh.stderr.on('data', d => { stderr += d; process.stderr.write(d); });

ssh.on('close', code => {
    console.log('\nExit code:', code);
    if (code !== 0) console.log('SSH stderr:', stderr);
});

ssh.stdin.write(pythonCode);
ssh.stdin.end();

setTimeout(() => {
    console.log('Timeout - forcing exit');
    process.exit(1);
}, 20000);
