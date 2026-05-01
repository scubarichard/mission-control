// /api/log — append a single chat turn to cosmos-dax-dev/dax-dev/messages
// SEC Rule 17a-4: 7-year retention, tamper-evident write-only audit trail.
// MongoDB API; uses connection string from COSMOS_CONNECTION_STRING app setting (KV-resolved).
const { MongoClient } = require('mongodb');

let cachedClient = null;
async function getClient() {
  if (cachedClient) return cachedClient;
  const uri = process.env.COSMOS_CONNECTION_STRING;
  if (!uri) throw new Error('COSMOS_CONNECTION_STRING app setting missing');
  cachedClient = new MongoClient(uri, { serverSelectionTimeoutMS: 4000 });
  await cachedClient.connect();
  return cachedClient;
}

module.exports = async function (context, req) {
  // Identify the caller via the SWA-provided client principal header.
  // dev.dax.dakona.com uses MSAL (no SWA built-in auth) so this header is empty;
  // the front-end will send userOid in the body. We accept either source.
  let userOid = null, userPrincipal = null;
  const cpHeader = req.headers['x-ms-client-principal'];
  if (cpHeader) {
    try {
      const cp = JSON.parse(Buffer.from(cpHeader, 'base64').toString('utf8'));
      userOid = (cp.claims || []).find(c => c.typ === 'http://schemas.microsoft.com/identity/claims/objectidentifier')?.val;
      userPrincipal = cp.userDetails;
    } catch {}
  }

  const body = req.body || {};
  const role = body.role;
  const content = body.content;
  const conversationId = body.conversationId;
  const activityId = body.activityId;
  const activityTimestamp = body.activityTimestamp;
  if (!role || !conversationId || !content) {
    context.res = { status: 400, body: { error: 'role, conversationId, content required' } };
    return;
  }
  userOid = userOid || body.userOid || null;
  userPrincipal = userPrincipal || body.userPrincipal || null;

  const doc = {
    _id: activityId || `${conversationId}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    role,
    content,
    conversationId,
    activityId: activityId || null,
    activityTimestamp: activityTimestamp || null,
    userOid,
    userPrincipal,
    botId: '389de172-2e44-f111-88b4-000d3a36c81b',
    botSchema: 'auto_agent_BotRI',
    promptVersion: 'v70',
    env: 'dev',
    receivedAt: new Date()
  };

  try {
    const client = await getClient();
    const db = client.db('dax-dev');
    await db.collection('messages').insertOne(doc);
    context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { logged: true, _id: doc._id } };
  } catch (e) {
    context.log.error('cosmos write failed:', e.message);
    context.res = { status: 500, body: { error: 'log write failed', detail: e.message } };
  }
};
