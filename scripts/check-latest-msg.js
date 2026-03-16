const { execSync } = require('child_process');
const { MongoClient } = require('mongodb');

async function main() {
    const connStr = execSync('az keyvault secret show --vault-name kvdaxdakonapilot --name cosmos-connection-string --query "value" -o tsv', 
        { encoding: 'utf8', timeout: 15000 }).trim().replace(/^ERROR:\s*/, '');

    const client = new MongoClient(connStr);
    await client.connect();
    const db = client.db('librechat');

    const msgs = await db.collection('messages').find({ 
        conversationId: 'd0e810ad-c4f0-45e7-9035-9d31e5ad6f00'
    }).sort({_id: 1}).toArray();

    msgs.forEach(m => {
        const role = m.role || m.sender;
        const content = m.content ? JSON.stringify(m.content).substring(0, 500) : m.text?.substring(0, 200);
        console.log(`[${role}]`, content);
        if (m.tool_calls) console.log('  tool_calls:', JSON.stringify(m.tool_calls));
    });

    await client.close();
}

main().catch(e => console.error('ERR:', e.message));
