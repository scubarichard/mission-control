const { app } = require('@azure/functions');
const {
  CopilotStudioClient,
  ConnectionSettings
} = require('@microsoft/agents-copilotstudio-client');

const TENANT_ID = process.env.TENANT_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const AGENT_DIRECT_CONNECT_URL = process.env.AGENT_DIRECT_CONNECT_URL;
const AGENT_SCOPE = 'https://api.powerplatform.com/CopilotStudio.Copilots.Invoke';

async function obo(userToken) {
  const params = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    assertion: userToken,
    scope: AGENT_SCOPE,
    requested_token_use: 'on_behalf_of'
  });
  const resp = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`OBO failed (${resp.status}): ${text.slice(0, 400)}`);
  }
  const data = JSON.parse(text);
  return data.access_token;
}

function readPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
  } catch (_) {
    return null;
  }
}

function userIdFromPrincipal(principal) {
  if (!principal) return 'anon';
  return (principal.userId || principal.userDetails || 'anon')
    .toString()
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 60) || 'anon';
}

app.http('agent-turn', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'agent/turn',
  handler: async (request, context) => {
    const principal = readPrincipal(request);
    if (!principal) {
      return { status: 401, jsonBody: { error: 'not_authenticated' } };
    }

    const userToken = request.headers.get('x-ms-token-aad-access-token');
    if (!userToken) {
      context.error('No x-ms-token-aad-access-token header — Easy Auth token store may be off or login scope insufficient.');
      return { status: 500, jsonBody: { error: 'no_user_access_token' } };
    }

    let body;
    try {
      body = await request.json();
    } catch (_) {
      return { status: 400, jsonBody: { error: 'invalid_json' } };
    }
    const text = (body && typeof body.text === 'string') ? body.text.trim() : '';
    if (!text) return { status: 400, jsonBody: { error: 'text_required' } };
    let conversationId = body.conversationId || null;

    let agentToken;
    try {
      agentToken = await obo(userToken);
    } catch (e) {
      context.error('OBO exchange failed:', e.message);
      return { status: 502, jsonBody: { error: 'obo_failed', detail: e.message } };
    }

    let client;
    try {
      const settings = new ConnectionSettings({ directConnectUrl: AGENT_DIRECT_CONNECT_URL });
      client = new CopilotStudioClient(settings, agentToken);
    } catch (e) {
      context.error('Client init failed:', e.message);
      return { status: 500, jsonBody: { error: 'client_init_failed', detail: e.message } };
    }

    try {
      if (!conversationId) {
        const startResp = await client.startConversationWithResponse(true);
        conversationId = startResp.conversationId || (startResp.activities || []).map((a) => a.conversation?.id).find(Boolean);
      }
      if (!conversationId) {
        return { status: 502, jsonBody: { error: 'no_conversation_id' } };
      }

      const userId = userIdFromPrincipal(principal);
      const activity = {
        type: 'message',
        text,
        from: { id: userId, name: principal.userDetails || userId },
        locale: 'en-US'
      };

      const turnResp = await client.executeWithResponse(activity, conversationId);
      const replies = (turnResp.activities || [])
        .filter((a) => a.type === 'message' && a.text)
        .map((a) => ({ text: a.text, attachments: a.attachments || [], suggestedActions: a.suggestedActions || null }));

      return {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
        jsonBody: { conversationId, replies }
      };
    } catch (e) {
      context.error('Agent call failed:', e.message, e.stack);
      return { status: 502, jsonBody: { error: 'agent_call_failed', detail: e.message } };
    }
  }
});
