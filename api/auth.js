export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).end('Method Not Allowed');
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).end('OAuth configuration missing');
  }

  // Generate a CSRF protection state value.
  const state = crypto.randomUUID();

  // Store state temporarily in a secure cookie.
  res.setHeader(
    'Set-Cookie',
    `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
  );

  const authUrl = new URL(
    'https://github.com/login/oauth/authorize'
  );

  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'repo');
  authUrl.searchParams.set('state', state);

  res.writeHead(302, {
    Location: authUrl.toString()
  });

  res.end();
}
