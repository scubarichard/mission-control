/**
 * Update the agent instructions in Cosmos to match the new system prompt
 * Also fixes tool names to include bare domain encoding
 */
const { execSync } = require('child_process');
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

async function main() {
    const connStr = execSync('az keyvault secret show --vault-name kvdaxdakonapilot --name cosmos-connection-string --query "value" -o tsv', 
        { encoding: 'utf8', timeout: 15000 }).trim().replace(/^ERROR:\s*/, '');

    const client = new MongoClient(connStr);
    await client.connect();
    const db = client.db('librechat');

    // Load updated system prompt from librechat.yaml
    const yamlPath = path.join('P:', '_clients', 'dakona', 'dax', 'librechat', 'librechat.yaml');
    const config = yaml.load(fs.readFileSync(yamlPath, 'utf8'));
    const instructions = config?.endpoints?.azureOpenAI?.systemPrompt || '';
    console.log('System prompt length:', instructions.length);
    console.log('Contains CRITICAL TOOL CALLING RULE:', instructions.includes('CRITICAL TOOL CALLING RULE'));

    // Both tool name encodings
    const domain = 'n8n.dakona.net';
    const fullUrlEncoded = Buffer.from('https://' + domain).toString('base64');
    const bareEncoded = Buffer.from(domain).toString('base64');

    const toolNames = [
        'actions',
        'generateICPReview_action_' + fullUrlEncoded,
        'saveClientDocument_action_' + fullUrlEncoded,
        'generateICPReview_action_' + bareEncoded,
        'saveClientDocument_action_' + bareEncoded,
    ];

    // Update agent
    const result = await db.collection('agents').updateOne(
        { id: 'agent_dax_main' },
        { $set: { instructions, tools: toolNames, updatedAt: new Date() } }
    );
    console.log('\nAgent updated:', result.modifiedCount, 'document(s)');

    // Verify
    const agent = await db.collection('agents').findOne({ id: 'agent_dax_main' });
    console.log('Instructions length:', agent.instructions.length);
    console.log('Has CRITICAL TOOL CALLING RULE:', agent.instructions.includes('CRITICAL TOOL CALLING RULE'));
    console.log('Tools:', JSON.stringify(agent.tools));

    await client.close();
}

main().catch(e => console.error('ERR:', e.message));
