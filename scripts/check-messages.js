/**
 * Check recent messages to see if tool calls are included
 */
const { execSync } = require('child_process');
const { MongoClient } = require('mongodb');

async function main() {
    const connStr = execSync('az keyvault secret show --vault-name kvdaxdakonapilot --name cosmos-connection-string --query "value" -o tsv', 
        { encoding: 'utf8', timeout: 15000 }).trim().replace(/^ERROR:\s*/, '');

    const client = new MongoClient(connStr);
    await client.connect();
    const db = client.db('librechat');

    // Get recent messages from the latest conversation
    const convos = await db.collection('conversations').find({}).sort({_id:-1}).limit(3).toArray();
    for (const convo of convos) {
        console.log('\nConvo:', convo.conversationId, '|', convo.title);
        const msgs = await db.collection('messages').find({ conversationId: convo.conversationId }).sort({_id:1}).toArray();
        msgs.forEach(m => {
            const role = m.role || m.sender || 'unknown';
            const text = typeof m.text === 'string' ? m.text.substring(0, 100) : JSON.stringify(m.content || m.text || '').substring(0, 100);
            const hasTool = m.tool_calls || m.toolCalls || m.content?.some?.(c => c.type === 'tool_use');
            console.log(` [${role}]`, text.replace(/\n/g, ' '), hasTool ? '| HAS_TOOL_CALL' : '');
        });
    }

    await client.close();
}

main().catch(e => console.error('ERR:', e.message));
