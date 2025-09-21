import { verifyJWT, parseCookies } from '../lib/auth.js';
import { participants, rounds } from '../lib/state.js';

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

    // 清空参与者和轮次数据
    participants.clear();
    rounds.clear();
    
    console.log('管理员重置所有数据');
    return res.json({ ok: true });
    
  } catch (error) {
    console.error('Reset-all endpoint error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
