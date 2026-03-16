/**
 * Fix agent ACL entries in Cosmos DB
 * - Add agent to instance project
 * - Create aclentries so ToolService can load the action tools
 */
const { execSync } = require('child_process');
const { MongoClient } = require('mongodb');

async function main() {
    const connStr = execSync('az keyvault secret show --vault-name kvdaxdakonapilot --name cosmos-connection-string --query "value" -o tsv', 
        { encoding: 'utf8', timeout: 15000 }).trim().replace(/^ERROR:\s*/, '');

    const client = new MongoClient(connStr);
    await client.connect();
    const db = client.db('librechat');

    // Get the instance project
    const project = await db.collection('projects').findOne({});
    console.log('Instance project:', project?.name, '| _id:', project?._id);

    // Get first user
    const user = await db.collection('users').findOne({});
    console.log('First user:', user?.email, '| _id:', user?._id);

    // Get agent
    const agent = await db.collection('agents').findOne({ id: 'agent_dax_main' });
    console.log('Agent found:', !!agent, '| projectIds:', JSON.stringify(agent?.projectIds));

    if (!agent) {
        console.error('Agent not found!');
        await client.close();
        return;
    }

    // 1. Add agent to instance project's projectIds
    if (!agent.projectIds || !agent.projectIds.length) {
        const updateResult = await db.collection('agents').updateOne(
            { id: 'agent_dax_main' },
            { $set: { projectIds: [project._id] } }
        );
        console.log('\nAdded agent to project:', updateResult.modifiedCount, 'modified');
    } else {
        console.log('\nAgent already in project(s):', JSON.stringify(agent.projectIds));
    }

    // 2. Check existing aclentries for this agent
    const existingAcl = await db.collection('aclentries').find({ 
        resourceId: 'agent_dax_main' 
    }).toArray();
    console.log('\nExisting ACL entries for agent:', existingAcl.length);

    if (existingAcl.length === 0) {
        // Create ACL entry making agent public (accessible to all users)
        // Structure matches LibreChat's ACL system for shared agents
        const aclEntry = {
            resourceId: 'agent_dax_main',
            resourceType: 'agent',
            userId: user._id,
            permissions: {
                use: true,
                update: true,
                create: true,
                read: true,
                share: true,
                remove: true,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        
        const insertResult = await db.collection('aclentries').insertOne(aclEntry);
        console.log('Created ACL entry:', insertResult.insertedId);

        // Also create a public/shared entry so all users can access
        const publicAcl = {
            resourceId: 'agent_dax_main',
            resourceType: 'agent',
            // No userId = public access
            permissions: {
                use: true,
                read: true,
            },
            isPublic: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const pubResult = await db.collection('aclentries').insertOne(publicAcl);
        console.log('Created public ACL entry:', pubResult.insertedId);
    } else {
        console.log('ACL entries already exist - skipping');
        existingAcl.forEach(a => console.log('  entry:', JSON.stringify(a)));
    }

    // Verify final state
    const finalAgent = await db.collection('agents').findOne({ id: 'agent_dax_main' });
    const finalAcl = await db.collection('aclentries').find({ resourceId: 'agent_dax_main' }).toArray();
    console.log('\n=== Final State ===');
    console.log('Agent projectIds:', JSON.stringify(finalAgent.projectIds));
    console.log('ACL entries:', finalAcl.length);

    await client.close();
    console.log('\nDone. No restart needed — takes effect on next conversation.');
}

main().catch(e => console.error('ERR:', e.message));
