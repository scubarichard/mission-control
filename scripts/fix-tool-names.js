/**
 * Add both bare-domain and full-URL encoded tool names to agent
 * to cover both possible domainParser encoding schemes
 */
const { execSync } = require('child_process');
const { MongoClient } = require('mongodb');

async function main() {
    const connStr = execSync('az keyvault secret show --vault-name kvdaxdakonapilot --name cosmos-connection-string --query "value" -o tsv', 
        { encoding: 'utf8', timeout: 15000 }).trim().replace(/^ERROR:\s*/, '');

    const client = new MongoClient(connStr);
    await client.connect();
    const db = client.db('librechat');

    const domain = 'n8n.dakona.net';
    const fullUrl = 'https://' + domain;
    const bareDomainEncoded = Buffer.from(domain).toString('base64');
    const fullUrlEncoded = Buffer.from(fullUrl).toString('base64');

    console.log('bare domain encoded:', bareDomainEncoded);
    console.log('full URL encoded:', fullUrlEncoded);

    // Build tools array with BOTH encodings
    const toolNames = [
        'actions',
        // Full URL encoding (what we had before)
        'generateICPReview_action_' + fullUrlEncoded,
        'saveClientDocument_action_' + fullUrlEncoded,
        // Bare domain encoding (what domainParser might use at runtime)
        'generateICPReview_action_' + bareDomainEncoded,
        'saveClientDocument_action_' + bareDomainEncoded,
    ];

    console.log('\nUpdating agent tools to include both encodings...');
    const result = await db.collection('agents').updateOne(
        { id: 'agent_dax_main' },
        { $set: { tools: toolNames } }
    );
    console.log('Modified:', result.modifiedCount);

    const agent = await db.collection('agents').findOne({ id: 'agent_dax_main' });
    console.log('\nFinal tools:', JSON.stringify(agent.tools, null, 2));

    await client.close();
}

main().catch(e => console.error('ERR:', e.message));
