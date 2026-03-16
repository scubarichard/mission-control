const fs = require('fs');
const file = 'scripts/Deploy-SSOConfig.ps1';
let c = fs.readFileSync(file, 'utf8');
const old = "                        @{ name = 'HOST'; value = '0.0.0.0' }";
const newStr = "                        @{ name = 'HOST'; value = '0.0.0.0' }\n                        @{ name = 'DEBUG'; value = 'librechat:*' }";
if (c.includes(old) && !c.includes("'DEBUG'")) {
    fs.writeFileSync(file, c.replace(old, newStr));
    console.log('Added DEBUG env var');
} else {
    console.log('Already has DEBUG or pattern not found');
}
