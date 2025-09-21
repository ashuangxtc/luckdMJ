import { verifyJWT, parseCookies } from '../../lib/auth.js';
import { getActivityConfig } from '../../lib/state.js';

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

    const activityConfig = getActivityConfig();
    const mode = activityConfig.redCountMode;
    const probability = [0, 1/3, 2/3, 1][mode];
    
    return res.json({ mode, probability });
    
  } catch (error) {
    console.error('Get-prob endpoint error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
