/**
 * Fix /home/dkn8n/mcp/server.js on n8n VM
 * - Remove duplicate stdin.resume() lines
 * - Ensure exactly one stdin.resume() before main()
 */
const { spawn } = require('child_process');

const bashScript = `
python3 << 'PYEOF'
with open('/home/dkn8n/mcp/server.js', 'r') as f:
    lines = f.readlines()

# Remove ALL stdin.resume and setEncoding lines first
cleaned = [l for l in lines if 'stdin.resume' not in l and 'stdin.setEncoding' not in l]

# Find the main().catch line and insert stdin.resume() before it
result = []
for line in cleaned:
    if line.strip().startswith('main().catch'):
        result.append('process.stdin.resume();\n')
    result.append(line)

with open('/home/dkn8n/mcp/server.js', 'w') as f:
    f.writelines(result)

count = sum(1 for l in result if 'stdin.resume' in l)
print('Done. Lines:', len(result), '| stdin.resume count:', count)
for l in result[-4:]:
    print(repr(l))
PYEOF
`;

const ssh = spawn('C:\\Windows\\System32\\OpenSSH\\ssh.exe', [
    '-T',
    '-i', 'C:/Users/18473/.ssh/id_rsa',
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ConnectTimeout=15',
    'dkn8n@n8n.dakona.net',
    'bash -s'
], { stdio: ['pipe', 'pipe', 'pipe'] });

let out = '';
ssh.stdout.on('data', d => { out += d; process.stdout.write(d); });
ssh.stderr.on('data', d => process.stderr.write(d));
ssh.on('close', code => {
    console.log('\nExit:', code);
    if (!out) console.log('No output received');
});
ssh.stdin.write(bashScript);
ssh.stdin.end();

setTimeout(() => { 
    console.log('Result:', out || 'no output');
    process.exit(0); 
}, 20000);
