module.exports = async function (context, req) {
  const principalHeader = req.headers['x-ms-client-principal'];
  if (!principalHeader) {
    context.res = { status: 401, body: 'Authentication required.' };
    return;
  }

  const accessToken = req.headers['x-ms-token-aad-access-token'];
  if (!accessToken) {
    // Diagnostic: dump all x-ms-* headers so we can see what SWA actually forwards
    const msHeaders = Object.keys(req.headers)
      .filter((k) => k.toLowerCase().startsWith('x-ms-'))
      .reduce((acc, k) => {
        const v = req.headers[k];
        acc[k] = typeof v === 'string' && v.length > 80 ? v.slice(0, 60) + '...(' + v.length + ')' : v;
        return acc;
      }, {});
    context.log.error('No x-ms-token-aad-access-token header. x-ms-* headers seen:', JSON.stringify(msHeaders));
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: {
        error: 'Server is not configured (no agent access token).',
        diag_x_ms_headers: msHeaders
      }
    };
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
