/**
 * Query Cosmos DB to check DAX agent and action state
 * Run: node scripts/query-cosmos.js
 */
const { execSync } = require('child_process');
const fs = require('fs');

// Get connection string from Key Vault
let connStr;
try {
    connStr = execSync('az keyvault secret show --vault-name kvdaxdakonapilot --name cosmos-connection-string --query "value" -o tsv 2>&1', 
        { encoding: 'utf8', timeout: 15000 }).trim().replace(/^ERROR:\s*/, '');
} catch(e) {
    console.error('Failed to get connection string:', e.message);
    process.exit(1);
}

const { MongoClient } = require('mongodb');
const client = new MongoClient(connStr);

async function main() {
    await client.connect();
    const db = client.db('librechat');

    // Check agent
    const agent = await db.collection('agents').findOne({ id: 'agent_dax_main' });
    if (agent) {
        console.log('AGENT FOUND');
        console.log('  tools:', JSON.stringify(agent.tools));
    } else {
        console.log('AGENT NOT FOUND');
    }

    // Check actions
    const actions = await db.collection('actions').find({ agent_id: 'agent_dax_main' }).toArray();
    console.log('ACTIONS COUNT:', actions.length);
    actions.forEach(a => {
        console.log('  action_id:', a.action_id);
        console.log('  domain:', a.metadata && a.metadata.domain);
    });

    await client.close();
}

main().catch(e => console.error('ERR:', e.message));
