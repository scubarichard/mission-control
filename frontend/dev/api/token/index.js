module.exports = async function (context, req) {
  const principalHeader = req.headers['x-ms-client-principal'];
  if (!principalHeader) {
    context.res = { status: 401, body: 'Authentication required.' };
    return;
  }

  const directLineSecret = process.env.DIRECTLINE_SECRET;
  if (!directLineSecret) {
    context.log.error('DIRECTLINE_SECRET app setting is missing.');
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

  const userId = 'dl_' + (principal.userId || principal.userDetails || 'anon').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);

  let dlRes;
  try {
    dlRes = await fetch('https://directline.botframework.com/v3/directline/tokens/generate', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + directLineSecret,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user: { id: userId, name: principal.userDetails || userId }
      })
    });
  } catch (err) {
    context.log.error('Direct Line fetch failed', err);
    context.res = { status: 502, body: 'Could not reach Direct Line.' };
    return;
  }

  if (!dlRes.ok) {
    const body = await dlRes.text().catch(() => '');
    context.log.error('Direct Line token exchange failed', dlRes.status, body);
    context.res = { status: 502, body: 'Direct Line rejected the token request.' };
    return;
  }

  const data = await dlRes.json();

  context.res = {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: {
      token: data.token,
      expires_in: data.expires_in,
      conversationId: data.conversationId,
      user: { id: userId, name: principal.userDetails || userId }
    }
  };
};
