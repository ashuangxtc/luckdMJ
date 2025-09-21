import { verifyJWT, parseCookies } from '../lib/auth.js';

export default function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Client-Id');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 从 Cookie 中获取 JWT token
    const cookies = parseCookies(req.headers.cookie || '');
    const token = cookies.admin_session;
    
    if (!token) {
      return res.status(401).json({ ok: false, error: 'NO_TOKEN' });
    }
    
    // 验证 JWT token
    const payload = verifyJWT(token);
    if (!payload || !payload.admin) {
      return res.status(401).json({ ok: false, error: 'INVALID_TOKEN' });
    }
    
    console.log('Session verified for admin, expires at:', payload.exp);
    return res.json({ ok: true, expiresAt: payload.exp });
    
  } catch (error) {
    console.error('Me endpoint error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
