export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).end('Method Not Allowed');
    }

    const { code, state, error, error_description } = req.query;

    if (error) {
      return res
        .status(400)
        .end(`GitHub OAuth error: ${error_description || error}`);
    }

    if (!code || !state) {
      return res.status(400).end('Missing OAuth code or state');
    }

    const cookies = req.headers.cookie || '';
    const stateCookie = cookies
      .split(';')
      .map(cookie => cookie.trim())
      .find(cookie => cookie.startsWith('oauth_state='));

    const savedState = stateCookie
      ? decodeURIComponent(stateCookie.substring('oauth_state='.length))
      : null;

    if (!savedState || savedState !== state) {
      return res.status(400).end('Invalid OAuth state');
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const redirectUri = process.env.GITHUB_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(500).end('OAuth configuration missing');
    }

    const tokenRes = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri
        })
      }
    );

    const data = await tokenRes.json();

    if (!tokenRes.ok || !data.access_token) {
      return res
        .status(400)
        .end(data.error_description || 'GitHub OAuth failed');
    }

    // Clear the temporary OAuth state cookie.
    res.setHeader(
      'Set-Cookie',
      'oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
    );

    // JSON.stringify safely escapes the token before inserting it
    // into the JavaScript below.
    const token = JSON.stringify(data.access_token);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>GitHub authentication</title>
</head>
<body>
<script>
  (function () {
    var token = ${token};

    if (window.opener) {
      window.opener.postMessage(
        {
          type: 'authorization',
          payload: {
            token: token,
            provider: 'github'
          }
        },
        'https://www.drenthe-bewust.nl'
      );

      window.close();
    } else {
      document.body.textContent =
        'Authentication completed. You can close this window.';
    }
  })();
</script>
</body>
</html>`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).end('OAuth callback failed');
  }
}
