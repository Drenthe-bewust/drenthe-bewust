export default function handler(req, res) {
  res.status(200).json({
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ? '✓' : '✗',
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET ? '✓' : '✗',
    GITHUB_REDIRECT_URI: process.env.GITHUB_REDIRECT_URI ? '✓' : '✗',
    NODE_ENV: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
}
