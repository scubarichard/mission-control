/**
 * Fix ACL - add access for the second user and make fully public
 */
const { execSync } = require('child_process');
const { MongoClient, ObjectId } = require('mongodb');

async function main() {
    const connStr = execSync('az keyvault secret show --vault-name kvdaxdakonapilot --name cosmos-connection-string --query "value" -o tsv', 
        { encoding: 'utf8', timeout: 15000 }).trim().replace(/^ERROR:\s*/, '');

    const client = new MongoClient(connStr);
    await client.connect();
    const db = client.db('librechat');

    // Find all users
    const users = await db.collection('users').find({}).toArray();
    console.log('All users:');
    users.forEach(u => console.log(' ', u._id, u.email || u.username));

    // Show existing ACL entries
    const existing = await db.collection('aclentries').find({ resourceId: 'agent_dax_main' }).toArray();
    console.log('\nExisting ACL entries:', existing.length);
    existing.forEach(e => console.log('  userId:', e.userId, 'permissions:', JSON.stringify(e.permissions)));

    // Add ACL entry for every user
    for (const user of users) {
        const exists = existing.find(e => e.userId?.toString() === user._id.toString());
        if (!exists) {
            const entry = {
                resourceId: 'agent_dax_main',
                resourceType: 'agent',
                userId: user._id,
                permissions: { use: true, update: true, create: true, read: true, share: true, remove: true },
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            const r = await db.collection('aclentries').insertOne(entry);
            console.log('\nAdded ACL for user:', user.email || user.username, '| insertedId:', r.insertedId);
        } else {
            console.log('\nACL already exists for:', user.email || user.username);
        }
    }

    // Also update the public entry to ensure it's correct
    await db.collection('aclentries').updateOne(
        { resourceId: 'agent_dax_main', isPublic: true },
        { $set: { permissions: { use: true, update: true, create: true, read: true } } }
    );

    const final = await db.collection('aclentries').find({ resourceId: 'agent_dax_main' }).toArray();
    console.log('\nFinal ACL entries:', final.length);

    await client.close();
}

main().catch(e => console.error('ERR:', e.message));
