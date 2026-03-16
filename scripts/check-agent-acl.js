/**
 * Check agent ACL entries and permissions in Cosmos
 */
const { execSync } = require('child_process');
const { MongoClient } = require('mongodb');

async function main() {
    const connStr = execSync('az keyvault secret show --vault-name kvdaxdakonapilot --name cosmos-connection-string --query "value" -o tsv', 
        { encoding: 'utf8', timeout: 15000 }).trim().replace(/^ERROR:\s*/, '');

    const client = new MongoClient(connStr);
    await client.connect();
    const db = client.db('librechat');

    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name).join(', '));

    // Check agent permissions collection
    const permCols = ['agentpermissions', 'agent_permissions', 'permissions', 'acl'];
    for (const col of permCols) {
        const count = await db.collection(col).countDocuments().catch(() => -1);
        if (count >= 0) console.log(`${col}: ${count} documents`);
    }

    // Check if agent has projectIds or collaborators
    const agent = await db.collection('agents').findOne({ id: 'agent_dax_main' });
    if (agent) {
        console.log('\nAgent fields:');
        console.log('  projectIds:', JSON.stringify(agent.projectIds));
        console.log('  isCollaborative:', agent.isCollaborative);
        console.log('  author:', agent.author);
        console.log('  actions:', JSON.stringify(agent.actions));
        
        // Check all keys
        const keys = Object.keys(agent).filter(k => !['instructions', '_id'].includes(k));
        console.log('  all keys:', keys.join(', '));
    }

    // Check projects collection  
    const projects = await db.collection('projects').find({}).toArray().catch(() => []);
    console.log('\nProjects count:', projects.length);
    projects.forEach(p => console.log('  project:', p.name, 'id:', p._id));

    await client.close();
}

main().catch(e => console.error('ERR:', e.message));
