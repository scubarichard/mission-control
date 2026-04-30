module.exports = async function (context, req) {
  const principalHeader = req.headers['x-ms-client-principal'];
  if (!principalHeader) {
    context.res = { status: 401, body: 'Authentication required.' };
    return;
  }

  const accessToken = req.headers['x-ms-token-aad-access-token'];
  if (!accessToken) {
    // Diagnostic: decode x-ms-auth-token to see what audience it's for
    let authTokenInfo = null;
    const authTokenHeader = req.headers['x-ms-auth-token'];
    if (authTokenHeader) {
      try {
        const raw = authTokenHeader.replace(/^Bearer\s+/i, '');
        const parts = raw.split('.');
        if (parts.length === 3) {
          const padded = parts[1] + '==='.slice(0, (4 - (parts[1].length % 4)) % 4);
          const payload = JSON.parse(
            Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
          );
          authTokenInfo = {
            aud: payload.aud,
            iss: payload.iss,
            scp: payload.scp,
            roles: payload.roles,
            appid: payload.appid,
            preferred_username: payload.preferred_username,
            exp: payload.exp,
            claims_keys: Object.keys(payload).sort()
          };
        }
      } catch (e) {
        authTokenInfo = { decode_error: String(e) };
      }
    }
    const msHeaderNames = Object.keys(req.headers)
      .filter((k) => k.toLowerCase().startsWith('x-ms-'))
      .sort();
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: {
        error: 'No x-ms-token-aad-access-token. SWA built-in auth may not forward IdP access tokens.',
        x_ms_header_names: msHeaderNames,
        x_ms_auth_token_decoded: authTokenInfo
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
