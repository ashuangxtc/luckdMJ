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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 验证管理员权限
    const cookies = parseCookies(req.headers.cookie || '');
    const token = cookies.admin_session;
    
    if (!token) {
      return res.status(401).json({ ok: false, error: 'NO_TOKEN' });
    }
    
    const payload = verifyJWT(token);
    if (!payload || !payload.admin) {
      return res.status(401).json({ ok: false, error: 'ADMIN_REQUIRED' });
    }

    const { state } = req.body;
    if (['waiting', 'open', 'closed'].includes(state)) {
      // 在实际应用中，这里应该更新数据库或环境变量
      // 目前只是模拟成功响应
      console.log(`管理员设置活动状态: -> ${state}`);
      return res.json({ ok: true, state: state });
    } else {
      return res.status(400).json({ error: 'INVALID_STATE' });
    }
    
  } catch (error) {
    console.error('Set-state endpoint error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
