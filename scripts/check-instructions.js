/**
 * Check agent instructions and the exact path in librechat.yaml
 */
const { execSync } = require('child_process');
const { MongoClient } = require('mongodb');

async function main() {
    const connStr = execSync('az keyvault secret show --vault-name kvdaxdakonapilot --name cosmos-connection-string --query "value" -o tsv', 
        { encoding: 'utf8', timeout: 15000 }).trim().replace(/^ERROR:\s*/, '');

    const client = new MongoClient(connStr);
    await client.connect();
    const db = client.db('librechat');

    const agent = await db.collection('agents').findOne({ id: 'agent_dax_main' });
    if (agent) {
        console.log('=== AGENT INSTRUCTIONS ===');
        console.log('length:', agent.instructions ? agent.instructions.length : 0);
        console.log('first 300 chars:', agent.instructions ? agent.instructions.substring(0, 300) : 'EMPTY');
        console.log('\n=== TOOLS ===');
        console.log(JSON.stringify(agent.tools));
    }

    await client.close();
}

main().catch(e => console.error('ERR:', e.message));
