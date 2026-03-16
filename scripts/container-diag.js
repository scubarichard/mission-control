// Diagnostic: test isActionDomainAllowed and loadAgentTools
// Upload to container and run via: node /tmp/diag.js
const path = require('path');
process.chdir('/app');

async function main() {
    const { isActionDomainAllowed } = require('/app/node_modules/@librechat/api');
    const { loadActionSets, domainParser } = require('/app/api/server/services/ActionService');
    
    console.log('=== Testing isActionDomainAllowed ===');
    
    // Test with our domain
    const domain = 'n8n.dakona.net';
    const allowedDomains = ['n8n.dakona.net'];
    
    try {
        const result = await isActionDomainAllowed(domain, allowedDomains);
        console.log('isActionDomainAllowed("n8n.dakona.net", ["n8n.dakona.net"]):', result);
    } catch(e) {
        console.log('isActionDomainAllowed error:', e.message);
    }
    
    // Test domainParser
    console.log('\n=== Testing domainParser ===');
    try {
        const encoded = await domainParser(domain, true);
        console.log('domainParser("n8n.dakona.net", true):', encoded);
        console.log('Expected (full URL):', Buffer.from('https://n8n.dakona.net').toString('base64'));
        console.log('Expected (bare):', Buffer.from('n8n.dakona.net').toString('base64'));
    } catch(e) {
        console.log('domainParser error:', e.message);
    }
    
    // Test loadActionSets
    console.log('\n=== Testing loadActionSets ===');
    try {
        const actions = await loadActionSets({ agent_id: 'agent_dax_main' });
        console.log('loadActionSets result count:', actions?.length);
        if (actions?.length > 0) {
            console.log('First action domain:', actions[0].metadata?.domain);
            console.log('First action type:', actions[0].type);
        }
    } catch(e) {
        console.log('loadActionSets error:', e.message);
    }
}

main().catch(console.error);
