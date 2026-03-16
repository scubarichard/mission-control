const fs = require('fs');
const yaml = require('js-yaml');

const filePath = 'P:/_clients/dakona/dax/librechat/librechat.yaml';
let content = fs.readFileSync(filePath, 'utf8');

// Find all remaining generateICPReview occurrences
let idx = 0;
let count = 0;
while (true) {
    const i = content.indexOf('generateICPReview', idx);
    if (i === -1) break;
    console.log('At', i, ':', JSON.stringify(content.substring(i, i + 100)));
    idx = i + 1;
    count++;
}
console.log('Total occurrences:', count);

// Replace ALL remaining references to generateICPReview or saveClientDocument by name
// with generic "document generation tool" language
const replacements = [
    ['IMMEDIATELY call generateICPReview', 'IMMEDIATELY invoke the document generation tool'],
    ['call generateICPReview', 'invoke the document generation tool'],
    ['generateICPReview_action_', 'generateICPReview_action_'],  // keep tool names as-is
    ['generateICPReview', 'the ICP document generation tool'],
    ['call saveClientDocument', 'invoke the document save tool'],
    ['saveClientDocument', 'the document save tool'],
];

for (const [old, newStr] of replacements) {
    if (old.includes('_action_')) continue; // skip tool name references
    const occurrences = content.split(old).length - 1;
    if (occurrences > 0) {
        content = content.split(old).join(newStr);
        console.log(`Replaced ${occurrences}x: ${old.substring(0, 50)}`);
    }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('\nDone. Verifying...');

try {
    const parsed = yaml.load(content);
    const sp = parsed.endpoints.azureOpenAI.systemPrompt;
    console.log('YAML valid - systemPrompt length:', sp.length);
    
    // Count remaining generateICPReview
    const remaining = (sp.match(/generateICPReview/g) || []).length;
    const remaining2 = (sp.match(/saveClientDocument/g) || []).length;
    console.log('Remaining generateICPReview refs:', remaining);
    console.log('Remaining saveClientDocument refs:', remaining2);
    console.log('Contains "invoke the ICP":', sp.includes('invoke the ICP'));
    console.log('Contains "document generation tool":', sp.includes('document generation tool'));
} catch(e) {
    console.log('YAML error:', e.message.substring(0, 300));
}
