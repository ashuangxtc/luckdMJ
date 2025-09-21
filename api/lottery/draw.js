import { getActivityState, getActivityConfig, participants, allocatePid, parseCookies, readClientId, sampleFacesByCount } from '../lib/state.js';

// 客户端ID到PID的映射
const clientIdToPid = new Map();

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
    const activityState = getActivityState();
    const activityConfig = getActivityConfig();
    
    // 检查活动状态
    if (activityState !== 'open') {
      return res.status(403).json({ error: 'ACTIVITY_NOT_OPEN', state: activityState });
    }

    // 允许通过 clientId 识别设备，避免前端因代理导致 cookie 丢失
    const clientId = readClientId(req);
    let pid = parseInt(parseCookies(req.headers.cookie || '').pid);
    let p = participants.get(pid);

    if (!p && clientId && clientIdToPid.has(clientId)) {
      pid = clientIdToPid.get(clientId);
      p = participants.get(pid);
    }

    // 如仍不存在且提供了 clientId，则为其分配一个参与者记录
    if (!p && clientId) {
      const newPid = allocatePid();
      const record = { pid: newPid, clientId, participated: false, joinedAt: Date.now() };
      participants.set(newPid, record);
      clientIdToPid.set(clientId, newPid);
      pid = newPid;
      p = record;
      // 写入 cookie，后续请求可复用
      res.setHeader('Set-Cookie', `pid=${newPid}; HttpOnly; Max-Age=${7*24*3600}; SameSite=Lax; Path=/`);
    }

    if (!p) {
      return res.status(400).json({ error: 'NO_PID' });
    }

    if (p.participated) {
      return res.status(409).json({ ok: false, error: 'ALREADY_PARTICIPATED', pid, win: p.win });
    }

    // 获取选择的牌索引（兼容 pick 字段）
    const choice = (req.body?.choice ?? req.body?.pick ?? 0);
    
    // 生成新的牌面排列
    const faces = sampleFacesByCount(activityConfig.redCountMode);
    const win = faces[choice] === 'zhong';
    
    console.log(`PID ${pid} 抽奖详情: 选择位置${choice}, 牌面[${faces.join(',')}], 选中${faces[choice]}, 结果${win ? '中奖' : '未中奖'}, redCountMode=${activityConfig.redCountMode}`);
    
    // 更新参与者信息
    p.participated = true;
    p.win = win;
    p.drawAt = Date.now();
    participants.set(pid, p);
    
    // 返回兼容格式 + 扩展字段
    const faceLabel = faces[choice] === 'zhong' ? '红中' : '白板';
    const winIndex = faces.findIndex(f => f === 'zhong');
    return res.json({ 
      ok: true,
      pid, 
      win, 
      isWinner: win, 
      label: faceLabel,
      deck: faces.map(f => f === 'zhong' ? 'hongzhong' : 'baiban'),
      winIndex: win ? choice : (winIndex >= 0 ? winIndex : undefined)
    });
    
  } catch (error) {
    console.error('Draw endpoint error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
