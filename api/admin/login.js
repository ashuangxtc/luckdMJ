import { ADMIN_PASSWORD, ADMIN_SESSION_TTL_MS, createJWT } from '../lib/auth.js';

export default function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Client-Id');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { password } = req.body || {};
    
    console.log('Login attempt, password provided:', !!password);
    console.log('Expected password:', ADMIN_PASSWORD);
    
    if (String(password || '') !== String(ADMIN_PASSWORD)) {
      console.log('Password mismatch');
      return res.status(401).json({ ok: false, error: 'INVALID_PASSWORD' });
    }
    
    // 创建 JWT token
    const token = createJWT({ 
      admin: true, 
      loginTime: Date.now() 
    });
    const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
    
    // 设置 HTTP-only cookie with JWT
    res.setHeader('Set-Cookie', `admin_session=${token}; HttpOnly; Max-Age=${ADMIN_SESSION_TTL_MS / 1000}; SameSite=Lax; Path=/`);
    
    console.log('Login successful, JWT token generated');
    return res.json({ ok: true, expiresAt });
    
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
