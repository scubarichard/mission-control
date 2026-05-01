const { app } = require('@azure/functions');

function readPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
  } catch (_) {
    return null;
  }
}

app.http('me', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'me',
  handler: async (request, context) => {
    const principal = readPrincipal(request);
    if (!principal) {
      return { status: 401, jsonBody: { error: 'not_authenticated' } };
    }
    const claims = Array.isArray(principal.claims) ? principal.claims : [];
    const get = (t) => (claims.find((c) => c.typ === t) || {}).val;
    return {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
      jsonBody: {
        userId: principal.userId || get('http://schemas.microsoft.com/identity/claims/objectidentifier'),
        userDetails: principal.userDetails || get('preferred_username'),
        identityProvider: principal.identityProvider,
        name: get('name')
      }
    };
  }
});
