import jwt from 'jsonwebtoken';

// Hardcoded users (in production, use a database)
const USERS = {
  'nvhooff@icloud.com': 'drenthe-bewust@26',
  'marcella@praktijkdekezel.nl': 'drenthe-bewust@26',
  'info@hands4flow.nl': 'drenthe-bewust@26'
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POST: Email + password login → JWT token
  if (req.method === 'POST') {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (USERS[email] !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const jwtSecret = process.env.JWT_SECRET || 'dev-secret-key';
    const token = jwt.sign({ email, provider: 'email' }, jwtSecret, { expiresIn: '7d' });

    return res.status(200).json({ token, email });
  }

  // GET: OAuth code exchange (legacy, for future use)
  const code = req.query.code || req.body?.code;

  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Missing GitHub credentials' });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.status(400).json({ error: tokenData.error_description || tokenData.error });
    }

    // Return token to Decap CMS
    return res.status(200).json({
      token: tokenData.access_token,
      provider: 'github',
    });
  } catch (error) {
    console.error('OAuth error:', error);
    return res.status(500).json({ error: 'Failed to exchange token' });
  }
}
