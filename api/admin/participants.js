import { verifyJWT, parseCookies } from '../lib/auth.js';
import { getActivityState, getActivityConfig, participants } from '../lib/state.js';

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

    const activityState = getActivityState();
    const activityConfig = getActivityConfig();

    const all = Array.from(participants.values())
      .sort((a, b) => a.pid - b.pid)
      .map(p => ({
        ...p,
        clientIdShort3: p.clientId ? (p.clientId.slice(-3).padStart(3,'0')) : null,
        status: p.participated ? (p.win ? '已中奖' : '未中奖') : '未参与',
        joinTime: new Date(p.joinedAt).toLocaleString('zh-CN'),
        drawTime: p.drawAt ? new Date(p.drawAt).toLocaleString('zh-CN') : null
      }));
    
    return res.json({ 
      total: all.length, 
      items: all,
      state: activityState,
      config: activityConfig,
      stats: {
        total: all.length,
        participated: all.filter(p => p.participated).length,
        winners: all.filter(p => p.win === true).length,
        pending: all.filter(p => !p.participated).length
      }
    });
    
  } catch (error) {
    console.error('Participants endpoint error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
