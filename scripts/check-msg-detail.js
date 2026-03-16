const { execSync } = require('child_process');
const { MongoClient } = require('mongodb');

async function main() {
    const connStr = execSync('az keyvault secret show --vault-name kvdaxdakonapilot --name cosmos-connection-string --query "value" -o tsv', 
        { encoding: 'utf8', timeout: 15000 }).trim().replace(/^ERROR:\s*/, '');

    const client = new MongoClient(connStr);
    await client.connect();
    const db = client.db('librechat');

    // Get the latest DAX assistant message
    const msgs = await db.collection('messages').find({ 
        conversationId: 'd0c29b86-853b-4d7f-aa30-a2430ed107c1'
    }).sort({_id:-1}).limit(5).toArray();

    msgs.forEach(m => {
        console.log('\n=== Message ===');
        console.log('role:', m.role || m.sender);
        console.log('keys:', Object.keys(m).join(', '));
        if (m.content) console.log('content:', JSON.stringify(m.content).substring(0, 400));
        if (m.text) console.log('text:', JSON.stringify(m.text).substring(0, 200));
        if (m.tool_calls) console.log('tool_calls:', JSON.stringify(m.tool_calls));
        if (m.toolCalls) console.log('toolCalls:', JSON.stringify(m.toolCalls));
        if (m.unfinishedMessage) console.log('unfinished:', JSON.stringify(m.unfinishedMessage).substring(0, 200));
    });

    await client.close();
}

main().catch(e => console.error('ERR:', e.message));
