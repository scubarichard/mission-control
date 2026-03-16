/**
 * Add LIBRECHAT_DEBUG env var and fix allowedDomains format
 * to include both bare domain and full URL
 */
const fs = require('fs');
const path = require('path');

const file = path.join('P:', '_clients', 'dakona', 'dax', 'librechat', 'librechat.yaml');
let content = fs.readFileSync(file, 'utf8');

// Current allowedDomains section
const oldActions = `# ---------- Actions (allowed domains for agent API calls) ----------
actions:
  allowedDomains:
    - "n8n.dakona.net"`;

// Add full URL format as well
const newActions = `# ---------- Actions (allowed domains for agent API calls) ----------
actions:
  allowedDomains:
    - "n8n.dakona.net"
    - "https://n8n.dakona.net"`;

if (content.includes(oldActions)) {
    content = content.replace(oldActions, newActions);
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated allowedDomains to include both formats');
} else {
    console.log('Pattern not found - checking current state:');
    const idx = content.indexOf('allowedDomains');
    console.log(content.substring(idx - 20, idx + 100));
}

// Verify YAML is valid
const yaml = require('js-yaml');
try {
    const parsed = yaml.load(content);
    console.log('YAML valid');
    console.log('allowedDomains:', parsed.actions?.allowedDomains);
} catch(e) {
    console.log('YAML error:', e.message);
}
