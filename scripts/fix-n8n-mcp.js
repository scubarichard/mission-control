/**
 * Fix the n8n MCP server.js via SSH
 * Run: node scripts/fix-n8n-mcp.js
 */
const { execSync } = require('child_process');

const pythonFix = `python3 -c "
content = open('/home/dkn8n/mcp/server.js').read()
old = 'main().catch(e => { process.stderr.write(e.message + chr(10)); process.exit(1); });'
new = 'process.stdin.resume();\\nmain().catch(e => { process.stderr.write(e.message + chr(10)); process.exit(1); });'
if old in content:
    open('/home/dkn8n/mcp/server.js','w').write(content.replace(old, new))
    print('FIXED')
else:
    # Try alternate ending
    old2 = chr(10).join(['main().catch(e => {', '  process.stderr.write(e.message + chr(34)\\\\n' + chr(34) + ');', '  process.exit(1);', '});'])
    print('NOT FOUND. Last 100 chars:', repr(content[-100:]))
"`;

const cmd = `ssh -T -i C:/Users/18473/.ssh/id_rsa -o StrictHostKeyChecking=no dkn8n@n8n.dakona.net "${pythonFix.replace(/"/g, '\\"')}"`;

try {
    const result = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    console.log('Result:', result);
} catch (e) {
    console.log('Error:', e.message);
    console.log('stdout:', e.stdout);
    console.log('stderr:', e.stderr);
}
