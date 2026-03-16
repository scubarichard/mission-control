/**
 * Query Cosmos - writes to stdout directly
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
    console.log('=== AGENT ===');
    if (agent) {
        console.log('tools:', JSON.stringify(agent.tools, null, 2));
        console.log('instructions length:', agent.instructions ? agent.instructions.length : 0);
    } else {
        console.log('NOT FOUND');
    }

    const actions = await db.collection('actions').find({ agent_id: 'agent_dax_main' }).toArray();
    console.log('\n=== ACTIONS ===');
    console.log('count:', actions.length);
    actions.forEach(a => {
        console.log('action_id:', a.action_id);
        console.log('domain:', a.metadata?.domain);
        console.log('auth type:', a.metadata?.auth?.type);
        const spec = JSON.parse(a.metadata?.raw_spec || '{}');
        console.log('spec servers:', JSON.stringify(spec.servers));
        console.log('spec paths:', Object.keys(spec.paths || {}));
    });

    await client.close();
}

main().catch(e => console.error('ERR:', e.message));
