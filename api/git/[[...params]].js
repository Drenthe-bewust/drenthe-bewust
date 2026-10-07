export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Missing GITHUB_TOKEN' });
  }

  // Get the path after /api/git/
  const path = req.query.params?.join('/') || '';

  // Forward to GitHub API with token
  const url = `https://api.github.com/repos/${path}`;

  const headers = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Decap-CMS-Proxy',
    ...req.headers,
  };
  delete headers.host;

  try {
    const response = await fetch(url, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.text();

    // Copy response headers
    response.headers.forEach((value, name) => {
      if (!['content-encoding', 'transfer-encoding'].includes(name.toLowerCase())) {
        res.setHeader(name, value);
      }
    });

    return res.status(response.status).send(data);
  } catch (error) {
    console.error('Git proxy error:', error);
    return res.status(500).json({ error: 'Failed to proxy request' });
  }
}
