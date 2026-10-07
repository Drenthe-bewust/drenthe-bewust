export default async function handler(req, res) {
  try {
    const { code } = req.query;
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const redirectUri = process.env.GITHUB_REDIRECT_URI;

    // Step 1: No code = initiate OAuth
    if (!code) {
      const authUrl = new URL('https://github.com/login/oauth/authorize');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', 'repo');
      authUrl.searchParams.set('state', Math.random().toString(36).substring(7));

      return res.status(302).setHeader('Location', authUrl.toString()).end();
    }

    // Step 2: Got code = exchange for token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri
      })
    });

    const data = await tokenRes.json();

    if (data.error) {
      throw new Error(data.error_description || 'OAuth failed');
    }

    // Step 3: Send token back to Decap
    res.setHeader('Content-Type', 'text/html');
    res.end(`
      <!DOCTYPE html>
      <html>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'authorization',
              payload: {
                token: '${data.access_token}',
                provider: 'github'
              }
            }, 'https://www.drenthe-bewust.nl');
            setTimeout(() => window.close(), 100);
          }
        </script>
      </body>
      </html>
    `);

  } catch (error) {
    res.status(500).end(`Error: ${error.message}`);
  }
}
