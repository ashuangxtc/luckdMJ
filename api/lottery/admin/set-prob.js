import { verifyJWT, parseCookies } from '../../lib/auth.js';

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

    const { mode, probability } = req.body || {};

    let nextMode;
    if ([0,1,2,3].includes(Number(mode))) {
      nextMode = Number(mode);
    } else if (typeof probability === 'number') {
      const p = Math.max(0, Math.min(1, Number(probability)));
      nextMode = (p <= 0.01 ? 0 : p < 0.5 ? 1 : p < 0.99 ? 2 : 3);
    }

    if (nextMode === undefined) {
      return res.status(400).json({ error: 'need mode (0|1|2|3) or probability (0~1)' });
    }

    // 在实际实现中，这里应该更新环境变量或数据库
    // 目前只返回成功，实际状态不会持久化
    console.log(`管理员更新红中张数: -> ${nextMode}`);
    
    const newProbability = [0, 1/3, 2/3, 1][nextMode];
    return res.json({ ok: true, mode: nextMode, probability: newProbability });
    
  } catch (error) {
    console.error('Set-prob endpoint error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
