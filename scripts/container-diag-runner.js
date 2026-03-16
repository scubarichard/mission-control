const { execSync } = require('child_process');

// Write the diagnostic script to the container via stdin pipe
const script = `
cd /app
node -e "
const{isActionDomainAllowed}=require('./node_modules/@librechat/api');
const{domainParser}=require('./api/server/services/ActionService');
async function run(){
  const d='n8n.dakona.net';
  const r1=await isActionDomainAllowed(d,['n8n.dakona.net']).catch(e=>'ERR:'+e.message);
  console.log('allowed_bare_in_list:'+r1);
  const r2=await isActionDomainAllowed(d,['https://n8n.dakona.net']).catch(e=>'ERR:'+e.message);
  console.log('allowed_https_in_list:'+r2);
  const r3=await isActionDomainAllowed(d,undefined).catch(e=>'ERR:'+e.message);
  console.log('allowed_undefined_list:'+r3);
  const r4=await isActionDomainAllowed(d,[]).catch(e=>'ERR:'+e.message);
  console.log('allowed_empty_list:'+r4);
  const dp1=await domainParser(d,true).catch(e=>'ERR:'+e.message);
  console.log('domainParser_bare:'+dp1);
  const dp2=await domainParser('https://'+d,true).catch(e=>'ERR:'+e.message);
  console.log('domainParser_full:'+dp2);
}
run().catch(console.error);
"
`;

// Write to tmp file and run via container exec
const { spawnSync } = require('child_process');

const tmpFile = require('os').tmpdir() + '/container_script.sh';
require('fs').writeFileSync(tmpFile, script, 'utf8');

const result = spawnSync('az', [
    'containerapp', 'exec',
    '--name', 'ca-dax-dakona-pilot',
    '--resource-group', 'rg-dax-dakona-pilot',
    '--command', 'sh',
    '--stdin'
], {
    input: script,
    encoding: 'utf8',
    timeout: 30000
});

console.log('STDOUT:', result.stdout);
console.log('STDERR:', result.stderr?.substring(0, 500));
