module.exports = async function (context, req) {
  const directConnectUrl = process.env.CONNECTION_STRING;
  const clientId = process.env.AAD_CLIENT_ID;
  if (!directConnectUrl || !clientId) {
    context.log.error('Missing CONNECTION_STRING or AAD_CLIENT_ID app setting.');
    context.res = { status: 500, body: 'Server is not configured.' };
    return;
  }

  context.res = {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300'
    },
    body: {
      directConnectUrl,
      clientId,
      tenantId: process.env.GRAPH_TENANT_ID,
      scope: 'https://api.powerplatform.com/CopilotStudio.Copilots.Invoke'
    }
  };
};
