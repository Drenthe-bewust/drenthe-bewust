export default async function handler(req, res) {
  try {
    const { code } = req.query;

    // Step 1: User clicks "Login with GitHub" → redirect to GitHub
    if (!code) {
      const clientId = process.env.GITHUB_CLIENT_ID;
      const redirectUri = process.env.GITHUB_REDIRECT_URI;

      if (!clientId || !redirectUri) {
        return res.status(500).send(`
          <h1>Configuration Error</h1>
          <p>Missing environment variables:</p>
          <ul>
            <li>GITHUB_CLIENT_ID: ${clientId ? '✓' : '✗'}</li>
            <li>GITHUB_REDIRECT_URI: ${redirectUri ? '✓' : '✗'}</li>
          </ul>
        `);
      }

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: 'repo',
        state: Math.random().toString(36).substring(7)
      });
      return res.redirect(`https://github.com/login/oauth/authorize?${params}`);
    }

  // Step 2: GitHub redirects back with code → exchange for token
  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code,
        redirect_uri: process.env.GITHUB_REDIRECT_URI
      })
    });

    const data = await tokenResponse.json();

    if (data.error) {
      return res.status(400).json({ error: data.error_description || 'OAuth failed' });
    }

    // Step 3: Send token back to Decap via postMessage
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>GitHub Auth</title></head>
      <body>
        <p>Authenticating...</p>
        <script>
          const token = '${data.access_token}';
          if (window.opener) {
            window.opener.postMessage({
              type: 'authorization',
              payload: {
                token: token,
                provider: 'github'
              }
            }, 'https://www.drenthe-bewust.nl');
            setTimeout(() => window.close(), 100);
          } else {
            document.body.innerHTML = '<h1>Auth successful</h1><p>Token: ' + token.substring(0, 20) + '...</p>';
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).send(`
      <h1>Authentication Error</h1>
      <p>${error.message}</p>
      <pre>${error.stack}</pre>
    `);
  }
}
