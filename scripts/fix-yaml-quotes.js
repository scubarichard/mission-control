const fs = require('fs');
const yaml = require('js-yaml');

const filePath = 'P:/_clients/dakona/dax/librechat/librechat.yaml';
let content = fs.readFileSync(filePath, 'utf8');

// Fix problematic characters that break YAML block scalar
// Replace curly/smart quotes with straight quotes
content = content.replace(/[\u201C\u201D]/g, '"');
content = content.replace(/[\u2018\u2019]/g, "'");
// Replace em-dash with hyphen
content = content.replace(/\u2014/g, '-');

// Also fix the inline promptPrefix version - replace the problematic sentence
const bad1 = 'Never say "I will generate", "Please hold on", or "Let me generate"';
const good1 = 'Never say I will generate, Please hold on, or Let me generate';
content = content.split(bad1).join(good1);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed special characters');

// Verify YAML is valid
try {
    const parsed = yaml.load(content);
    const sp = parsed.endpoints.azureOpenAI.systemPrompt;
    console.log('YAML valid - systemPrompt length:', sp.length);
    console.log('Contains CRITICAL TOOL CALLING:', sp.includes('CRITICAL TOOL CALLING RULE'));
} catch(e) {
    console.log('YAML parse error:', e.message.substring(0, 300));
}
