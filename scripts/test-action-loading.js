/**
 * Diagnostic: Test loadActionSets directly inside the container
 * Deploy via entrypoint patch temporarily to see what happens
 * 
 * Run on n8n VM or locally via: node scripts/test-action-loading.js
 * Tests the exact same query ToolService uses at runtime
 */
const { execSync } = require('child_process');
const { MongoClient } = require('mongodb');

async function main() {
    const connStr = execSync('az keyvault secret show --vault-name kvdaxdakonapilot --name cosmos-connection-string --query "value" -o tsv', 
        { encoding: 'utf8', timeout: 15000 }).trim().replace(/^ERROR:\s*/, '');

    const client = new MongoClient(connStr);
    await client.connect();
    const db = client.db('librechat');

    // Simulate exactly what ToolService does at line 961:
    // const actionSets = (await loadActionSets({ agent_id: agent.id })) ?? [];
    // agent.id = 'agent_dax_main'

    console.log('=== Simulating loadActionSets({ agent_id: agent.id }) ===');
    console.log('Query: { agent_id: "agent_dax_main" }');
    
    // Raw query
    const actions = await db.collection('actions').find({ agent_id: 'agent_dax_main' }).toArray();
    console.log('\nRaw query result count:', actions.length);
    
    if (actions.length > 0) {
        const a = actions[0];
        console.log('\nAction document:');
        console.log('  _id:', a._id);
        console.log('  action_id:', a.action_id);
        console.log('  agent_id:', a.agent_id);
        console.log('  type:', a.type);
        console.log('  user:', a.user);
        console.log('  metadata.domain:', a.metadata?.domain);
        console.log('  metadata.auth:', JSON.stringify(a.metadata?.auth));
        console.log('  metadata.raw_spec starts with:', a.metadata?.raw_spec?.substring(0, 60).replace(/\n/g, '\\n'));
        
        // Check if raw_spec is parseable YAML
        try {
            const yaml = require('js-yaml');
            const parsed = yaml.load(a.metadata.raw_spec);
            console.log('\n  raw_spec parses as YAML OK');
            console.log('  servers:', JSON.stringify(parsed.servers));
            console.log('  paths:', Object.keys(parsed.paths || {}));
            console.log('  operationIds:', Object.values(parsed.paths || {}).flatMap(p => Object.values(p).map(op => op.operationId)));
        } catch(e) {
            console.log('\n  raw_spec YAML parse FAILED:', e.message);
        }
    }

    // Check if ToolService's domainParser would match
    // domainParser(action.metadata.domain, true) -> base64 encode
    const domain = 'n8n.dakona.net';
    const fullUrl = 'https://' + domain;
    const encoded = Buffer.from(fullUrl).toString('base64');
    console.log('\n=== Tool name matching ===');
    console.log('domain:', domain);
    console.log('fullUrl:', fullUrl);
    console.log('base64 encoded:', encoded);
    console.log('Expected tool names:');
    console.log('  generateICPReview_action_' + encoded);
    console.log('  saveClientDocument_action_' + encoded);
    
    // Check agent tools array
    const agent = await db.collection('agents').findOne({ id: 'agent_dax_main' });
    console.log('\nAgent tools:', JSON.stringify(agent.tools));
    console.log('\nMatch check:');
    agent.tools.forEach(t => {
        const expectedSuffix = '_action_' + encoded;
        console.log(' ', t, '->', t.includes(expectedSuffix) ? 'MATCH' : 'NO MATCH');
    });

    await client.close();
}

main().catch(e => console.error('ERR:', e.message));
