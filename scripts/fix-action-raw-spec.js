/**
 * Fix the existing action document in Cosmos:
 * - Change raw_spec from JSON string to YAML string
 * - This is the root cause of the action not firing
 */
const { execSync } = require('child_process');
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

async function main() {
    const connStr = execSync('az keyvault secret show --vault-name kvdaxdakonapilot --name cosmos-connection-string --query "value" -o tsv', 
        { encoding: 'utf8', timeout: 15000 }).trim().replace(/^ERROR:\s*/, '');

    const client = new MongoClient(connStr);
    await client.connect();
    const db = client.db('librechat');

    // Read the raw YAML spec
    const yamlSpec = fs.readFileSync(
        path.join('P:', '_clients', 'dakona', 'dax', 'librechat', 'tools', 'openapi-docgen.yaml'),
        'utf8'
    );
    console.log('YAML spec loaded:', yamlSpec.length, 'chars');
    console.log('First 80 chars:', yamlSpec.substring(0, 80).replace(/\n/g, '\\n'));

    // Check current state
    const current = await db.collection('actions').findOne({ action_id: 'action_dax_docgen' });
    if (!current) {
        console.log('ACTION NOT FOUND');
        await client.close();
        return;
    }
    console.log('\nCurrent raw_spec type:', typeof current.metadata.raw_spec);
    console.log('Current raw_spec first 80 chars:', current.metadata.raw_spec.substring(0, 80).replace(/\n/g, '\\n'));

    // Check if it's JSON (starts with { or [) vs YAML (starts with openapi or ---)
    const isJSON = current.metadata.raw_spec.trim().startsWith('{') || current.metadata.raw_spec.trim().startsWith('[');
    console.log('\nIs currently stored as JSON?', isJSON);

    if (!isJSON) {
        console.log('Already stored as YAML — no fix needed');
        await client.close();
        return;
    }

    // Fix: update raw_spec to be the YAML string
    const result = await db.collection('actions').updateOne(
        { action_id: 'action_dax_docgen' },
        { $set: { 'metadata.raw_spec': yamlSpec } }
    );
    console.log('\nUpdate result:', result.modifiedCount, 'document(s) modified');

    // Verify
    const updated = await db.collection('actions').findOne({ action_id: 'action_dax_docgen' });
    console.log('Updated raw_spec first 80 chars:', updated.metadata.raw_spec.substring(0, 80).replace(/\n/g, '\\n'));
    console.log('Is now YAML?', !updated.metadata.raw_spec.trim().startsWith('{'));

    await client.close();
    console.log('\nDone. Container restart NOT required — fix takes effect on next conversation.');
}

main().catch(e => console.error('ERR:', e.message));
