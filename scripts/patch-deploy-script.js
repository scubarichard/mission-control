/**
 * Insert ACTIONS env vars into Deploy-SSOConfig.ps1
 */
const fs = require('fs');
const path = require('path');

const file = path.join('P:', '_clients', 'dakona', 'dax', 'scripts', 'Deploy-SSOConfig.ps1');
let content = fs.readFileSync(file, 'utf8');

const searchLine = "                        @{ name = 'TTS_API_KEY'; value = $ttsApiKey }";
const insertAfter = [
    "                        # Agent actions - required for LibreChat to execute outbound HTTP from agents",
    "                        @{ name = 'ACTIONS_ENDPOINT_URL'; value = $domainServer }",
    "                        @{ name = 'ACTIONS_ALLOWED_DOMAINS'; value = 'n8n.dakona.net' }",
].join('\n');

if (content.includes('ACTIONS_ENDPOINT_URL')) {
    console.log('Already contains ACTIONS_ENDPOINT_URL - no change needed');
} else if (content.includes(searchLine)) {
    content = content.replace(searchLine, searchLine + '\n' + insertAfter);
    fs.writeFileSync(file, content, 'utf8');
    console.log('SUCCESS: Added ACTIONS_ENDPOINT_URL and ACTIONS_ALLOWED_DOMAINS to Deploy-SSOConfig.ps1');
    // Verify
    const lines = content.split('\n');
    const idx = lines.findIndex(l => l.includes('ACTIONS_ENDPOINT_URL'));
    console.log('Verification - line', idx + 1, ':', lines[idx]);
} else {
    console.log('ERROR: Search line not found');
    const idx = content.indexOf('TTS_API_KEY');
    console.log('TTS_API_KEY context:', JSON.stringify(content.substring(idx - 50, idx + 100)));
}
