module.exports = async function (context, req) {
  const principalHeader = req.headers['x-ms-client-principal'];
  if (!principalHeader) {
    context.res = { status: 401, body: 'Authentication required.' };
    return;
  }

  const accessToken = req.headers['x-ms-token-aad-access-token'];
  if (!accessToken) {
    context.log.error('No x-ms-token-aad-access-token header. Check SWA loginParameters scope.');
    context.res = { status: 500, body: 'Server is not configured (no agent access token).' };
    return;
  }

  const directConnectUrl = process.env.CONNECTION_STRING;
  if (!directConnectUrl) {
    context.log.error('CONNECTION_STRING app setting is missing.');
    context.res = { status: 500, body: 'Server is not configured (no agent endpoint).' };
    return;
  }

  let principal;
  try {
    principal = JSON.parse(Buffer.from(principalHeader, 'base64').toString('utf8'));
  } catch (err) {
    context.res = { status: 400, body: 'Invalid principal header.' };
    return;
  }

  const expiresOnHeader = req.headers['x-ms-token-aad-expires-on'];

  context.res = {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: {
      token: accessToken,
      directConnectUrl,
      expiresOn: expiresOnHeader || null,
      user: { id: principal.userId, name: principal.userDetails }
    }
  };
};
