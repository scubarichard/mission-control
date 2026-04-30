module.exports = async function (context, req) {
  const principalHeader = req.headers['x-ms-client-principal'];
  if (!principalHeader) {
    context.res = { status: 401, body: 'Authentication required.' };
    return;
  }

  const directConnectUrl = process.env.CONNECTION_STRING;
  const clientId = process.env.AAD_CLIENT_ID;
  if (!directConnectUrl || !clientId) {
    context.log.error('Missing CONNECTION_STRING or AAD_CLIENT_ID app setting.');
    context.res = { status: 500, body: 'Server is not configured.' };
    return;
  }

  let principal;
  try {
    principal = JSON.parse(Buffer.from(principalHeader, 'base64').toString('utf8'));
  } catch (err) {
    context.res = { status: 400, body: 'Invalid principal header.' };
    return;
  }

  context.res = {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: {
      directConnectUrl,
      clientId,
      tenantId: 'd2a3c346-00f3-47dd-a53e-caa3fca74714',
      scope: 'https://api.powerplatform.com/CopilotStudio.Copilots.Invoke',
      user: { id: principal.userId, name: principal.userDetails }
    }
  };
};
