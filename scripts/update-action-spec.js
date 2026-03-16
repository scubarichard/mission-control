/**
 * Update Cosmos action raw_spec with new YAML containing x-strict: true
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

    // Read updated YAML spec
    const yamlPath = path.join('P:', '_clients', 'dakona', 'dax', 'librechat', 'tools', 'openapi-docgen.yaml');
    const yamlSpec = fs.readFileSync(yamlPath, 'utf8');
    
    // Verify x-strict is in it
    const parsed = yaml.load(yamlSpec);
    const generateOp = parsed.paths['/webhook/generate-document']?.post;
    console.log('x-strict on generateICPReview:', generateOp?.['x-strict']);
    console.log('version:', parsed.info.version);

    // Update action raw_spec
    const result = await db.collection('actions').updateOne(
        { action_id: 'action_dax_docgen' },
        { $set: { 'metadata.raw_spec': yamlSpec } }
    );
    console.log('Action updated:', result.modifiedCount, 'document(s)');

    // Verify
    const action = await db.collection('actions').findOne({ action_id: 'action_dax_docgen' });
    const verifyParsed = yaml.load(action.metadata.raw_spec);
    console.log('Verified x-strict:', verifyParsed.paths['/webhook/generate-document']?.post?.['x-strict']);

    await client.close();
    console.log('\nDone. No restart needed - takes effect on next conversation.');
}

main().catch(e => console.error('ERR:', e.message));
