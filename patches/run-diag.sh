#!/bin/sh
cd /app
node << 'EOF'
process.chdir('/app');
const { isActionDomainAllowed } = require('./node_modules/@librechat/api');
const { domainParser } = require('./api/server/services/ActionService');

async function main() {
    const domain = 'n8n.dakona.net';
    const allowed = ['n8n.dakona.net'];

    const r1 = await isActionDomainAllowed(domain, allowed).catch(e => 'ERR:' + e.message);
    console.log('isActionDomainAllowed(n8n.dakona.net, [n8n.dakona.net]):', r1);

    const r2 = await isActionDomainAllowed(domain, ['https://n8n.dakona.net']).catch(e => 'ERR:' + e.message);
    console.log('isActionDomainAllowed(n8n.dakona.net, [https://n8n.dakona.net]):', r2);

    const r3 = await isActionDomainAllowed(domain, undefined).catch(e => 'ERR:' + e.message);
    console.log('isActionDomainAllowed(n8n.dakona.net, undefined):', r3);

    const r4 = await domainParser(domain, true).catch(e => 'ERR:' + e.message);
    console.log('domainParser(n8n.dakona.net, true):', r4);

    const r5 = await domainParser('https://' + domain, true).catch(e => 'ERR:' + e.message);
    console.log('domainParser(https://n8n.dakona.net, true):', r5);

    console.log('base64 bare:', Buffer.from(domain).toString('base64'));
    console.log('base64 full:', Buffer.from('https://' + domain).toString('base64'));
}
main().catch(console.error);
EOF
