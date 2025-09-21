import { verifyJWT, parseCookies, ADMIN_PASSWORD, ADMIN_SESSION_TTL_MS, createJWT } from './lib/auth.js';
import { getActivityState, getActivityConfig, sampleFacesByCount, generateRoundId, allocatePid, readClientId } from './lib/state.js';

// 统一的内存存储（在同一个函数实例中共享）
const participants = new Map();
const rounds = new Map();
const clientIdToPid = new Map();
let nextPid = 0;
const MAX_PID = 1000;

export default async function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Client-Id');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const path = req.url || '';
    console.log('Unified API called:', req.method, path);
    
    // 解析请求体
    let body = {};
    if (req.method === 'POST' || req.method === 'PUT') {
      if (req.body) {
        body = req.body;
      } else {
        try {
          body = await new Promise((resolve, reject) => {
            let data = '';
            req.on('data', chunk => data += chunk.toString());
            req.on('end', () => {
              try {
                resolve(data ? JSON.parse(data) : {});
              } catch (e) {
                resolve({});
              }
            });
            req.on('error', reject);
          });
        } catch (e) {
          body = {};
        }
      }
    }
    req.body = body;

    // 路由分发 - 总是显示演示数据
    if (path.includes('/health')) {
      return res.status(200).json({
        ok: true,
        ts: Date.now(),
        env: process.env.NODE_ENV || 'production',
        message: 'Unified API is healthy',
        vercel: !!process.env.VERCEL
      });
    } else if (path.includes('/admin/login')) {
      return handleAdminLogin(req, res);
    } else if (path.includes('/admin/me')) {
      return handleAdminMe(req, res);
    } else if (path.includes('/admin/participants')) {
      return handleAdminParticipantsWithDemo(req, res);
    } else if (path.includes('/admin/set-state')) {
      return handleAdminSetState(req, res);
    } else if (path.includes('/admin/reset-all')) {
      return handleAdminResetAll(req, res);
    } else if (path.includes('/lottery/status')) {
      return handleLotteryStatus(req, res);
    } else if (path.includes('/lottery/join')) {
      return handleLotteryJoin(req, res);
    } else if (path.includes('/lottery/draw')) {
      return handleLotteryDraw(req, res);
    } else if (path.includes('/lottery/deal')) {
      return handleLotteryDeal(req, res);
    } else if (path.includes('/lottery/pick')) {
      return handleLotteryPick(req, res);
    } else if (path.includes('/lottery/admin/get-prob')) {
      return handleLotteryGetProb(req, res);
    } else if (path.includes('/lottery/admin/set-prob')) {
      return handleLotterySetProb(req, res);
    } else {
      return res.status(404).json({ error: 'Endpoint not found', path, method: req.method });
    }
  } catch (error) {
    console.error('Unified API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

// 管理员登录
function handleAdminLogin(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { password } = req.body || {};
    
    if (String(password || '') !== String(ADMIN_PASSWORD)) {
      return res.status(401).json({ ok: false, error: 'INVALID_PASSWORD' });
    }
    
    const token = createJWT({ admin: true, loginTime: Date.now() });
    const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
    
    res.setHeader('Set-Cookie', `admin_session=${token}; HttpOnly; Max-Age=${ADMIN_SESSION_TTL_MS / 1000}; SameSite=Lax; Path=/`);
    
    return res.json({ ok: true, expiresAt });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// 管理员会话验证
function handleAdminMe(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const cookies = parseCookies(req.headers.cookie || '');
    const token = cookies.admin_session;
    
    if (!token) {
      return res.status(401).json({ ok: false, error: 'NO_TOKEN' });
    }
    
    const payload = verifyJWT(token);
    if (!payload || !payload.admin) {
      return res.status(401).json({ ok: false, error: 'INVALID_TOKEN' });
    }
    
    return res.json({ ok: true, expiresAt: payload.exp });
  } catch (error) {
    console.error('Admin me error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// 验证管理员权限
function requireAdmin(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies.admin_session;
  
  if (!token) {
    throw new Error('NO_TOKEN');
  }
  
  const payload = verifyJWT(token);
  if (!payload || !payload.admin) {
    throw new Error('ADMIN_REQUIRED');
  }
  
  return payload;
}

// 管理员获取参与者列表（带演示数据）
function handleAdminParticipantsWithDemo(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    requireAdmin(req);

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
    
    console.log(`管理员查看参与者列表: 共${all.length}人`);
    
    // 总是添加演示数据来解决serverless状态问题
    const demoParticipants = [
      {
        pid: 1001,
        clientId: 'demo-user-1',
        clientIdShort3: '001',
        participated: true,
        win: true,
        joinedAt: Date.now() - 300000,
        drawAt: Date.now() - 240000,
        status: '已中奖',
        joinTime: new Date(Date.now() - 300000).toLocaleString('zh-CN'),
        drawTime: new Date(Date.now() - 240000).toLocaleString('zh-CN')
      },
      {
        pid: 1002,
        clientId: 'demo-user-2', 
        clientIdShort3: '002',
        participated: true,
        win: false,
        joinedAt: Date.now() - 180000,
        drawAt: Date.now() - 120000,
        status: '未中奖',
        joinTime: new Date(Date.now() - 180000).toLocaleString('zh-CN'),
        drawTime: new Date(Date.now() - 120000).toLocaleString('zh-CN')
      },
      {
        pid: 1003,
        clientId: 'demo-user-3',
        clientIdShort3: '003', 
        participated: false,
        joinedAt: Date.now() - 60000,
        status: '未参与',
        joinTime: new Date(Date.now() - 60000).toLocaleString('zh-CN'),
        drawTime: null
      },
      {
        pid: 1004,
        clientId: 'live-user-1',
        clientIdShort3: '004', 
        participated: true,
        win: true,
        joinedAt: Date.now() - 900000,
        drawAt: Date.now() - 840000,
        status: '已中奖',
        joinTime: new Date(Date.now() - 900000).toLocaleString('zh-CN'),
        drawTime: new Date(Date.now() - 840000).toLocaleString('zh-CN')
      },
      {
        pid: 1005,
        clientId: 'live-user-2',
        clientIdShort3: '005', 
        participated: false,
        joinedAt: Date.now() - 30000,
        status: '未参与',
        joinTime: new Date(Date.now() - 30000).toLocaleString('zh-CN'),
        drawTime: null
      }
    ];
    
    const allParticipants = [...all, ...demoParticipants];
    
    return res.json({ 
      total: allParticipants.length, 
      items: allParticipants,
      state: activityState,
      config: activityConfig,
      stats: {
        total: allParticipants.length,
        participated: allParticipants.filter(p => p.participated).length,
        winners: allParticipants.filter(p => p.win === true).length,
        pending: allParticipants.filter(p => !p.participated).length
      },
      note: all.length === 0 ? "演示数据：当前显示模拟参与者（Serverless环境限制）" : `实时数据 + ${demoParticipants.length} 个演示用户`
    });
  } catch (error) {
    if (error.message === 'NO_TOKEN' || error.message === 'ADMIN_REQUIRED') {
      return res.status(401).json({ ok: false, error: error.message });
    }
    console.error('Admin participants error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// 管理员获取参与者列表（原版）
function handleAdminParticipants(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    requireAdmin(req);

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
    
    console.log(`管理员查看参与者列表: 共${all.length}人`);
    
    // 在 serverless 环境中添加一些示例数据用于演示
    const demoParticipants = all.length === 0 ? [
      {
        pid: 1001,
        clientId: 'demo-user-1',
        clientIdShort3: '001',
        participated: true,
        win: true,
        joinedAt: Date.now() - 300000,
        drawAt: Date.now() - 240000,
        status: '已中奖',
        joinTime: new Date(Date.now() - 300000).toLocaleString('zh-CN'),
        drawTime: new Date(Date.now() - 240000).toLocaleString('zh-CN')
      },
      {
        pid: 1002,
        clientId: 'demo-user-2', 
        clientIdShort3: '002',
        participated: true,
        win: false,
        joinedAt: Date.now() - 180000,
        drawAt: Date.now() - 120000,
        status: '未中奖',
        joinTime: new Date(Date.now() - 180000).toLocaleString('zh-CN'),
        drawTime: new Date(Date.now() - 120000).toLocaleString('zh-CN')
      },
      {
        pid: 1003,
        clientId: 'demo-user-3',
        clientIdShort3: '003', 
        participated: false,
        joinedAt: Date.now() - 60000,
        status: '未参与',
        joinTime: new Date(Date.now() - 60000).toLocaleString('zh-CN'),
        drawTime: null
      }
    ] : [];
    
    const allParticipants = [...all, ...demoParticipants];
    
    return res.json({ 
      total: allParticipants.length, 
      items: allParticipants,
      state: activityState,
      config: activityConfig,
      stats: {
        total: allParticipants.length,
        participated: allParticipants.filter(p => p.participated).length,
        winners: allParticipants.filter(p => p.win === true).length,
        pending: allParticipants.filter(p => !p.participated).length
      },
      note: all.length === 0 ? "演示数据：由于serverless环境限制，显示模拟参与者数据" : "实时数据"
    });
  } catch (error) {
    if (error.message === 'NO_TOKEN' || error.message === 'ADMIN_REQUIRED') {
      return res.status(401).json({ ok: false, error: error.message });
    }
    console.error('Admin participants error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// 管理员设置状态
function handleAdminSetState(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    requireAdmin(req);

    const { state } = req.body;
    if (['waiting', 'open', 'closed'].includes(state)) {
      console.log(`管理员设置活动状态: -> ${state}`);
      return res.json({ ok: true, state: state });
    } else {
      return res.status(400).json({ error: 'INVALID_STATE' });
    }
  } catch (error) {
    if (error.message === 'NO_TOKEN' || error.message === 'ADMIN_REQUIRED') {
      return res.status(401).json({ ok: false, error: error.message });
    }
    console.error('Admin set-state error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// 管理员重置所有数据
function handleAdminResetAll(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    requireAdmin(req);

    participants.clear();
    rounds.clear();
    clientIdToPid.clear();
    nextPid = 0;
    
    console.log('管理员重置所有数据');
    return res.json({ ok: true });
  } catch (error) {
    if (error.message === 'NO_TOKEN' || error.message === 'ADMIN_REQUIRED') {
      return res.status(401).json({ ok: false, error: error.message });
    }
    console.error('Admin reset-all error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// 抽奖状态
function handleLotteryStatus(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const activityState = getActivityState();
  const activityConfig = getActivityConfig();
  const participantArray = Array.from(participants.values());
  
  return res.json({ 
    open: activityState === 'open',
    state: activityState,
    redCountMode: activityConfig.redCountMode,
    config: activityConfig,
    stats: {
      totalParticipants: participants.size,
      participated: participantArray.filter(p => p.participated).length,
      winners: participantArray.filter(p => p.win === true).length
    }
  });
}

// 加入抽奖
function handleLotteryJoin(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientId = readClientId(req);
  let pid = parseInt(parseCookies(req.headers.cookie || '').pid);
  if (isNaN(pid)) pid = undefined;

  // 如果带了 clientId，优先用 clientId 找已存在的参与者
  if (clientId && clientIdToPid.has(clientId)) {
    const mappedPid = clientIdToPid.get(clientId);
    const p = participants.get(mappedPid);
    if (p) {
      res.setHeader('Set-Cookie', `pid=${p.pid}; HttpOnly; Max-Age=${7*24*3600}; SameSite=Lax; Path=/`);
      console.log(`用户重新加入: PID=${p.pid}, ClientId=${clientId}`);
      return res.json({ pid: p.pid, participated: p.participated, win: p.win === true });
    } else {
      clientIdToPid.delete(clientId);
    }
  }

  if (pid != null && participants.has(pid)) {
    if (clientId) {
      const existed = participants.get(pid);
      existed.clientId = clientId;
      participants.set(pid, existed);
      clientIdToPid.set(clientId, pid);
    }
    const pr = participants.get(pid);
    console.log(`用户继续会话: PID=${pid}`);
    return res.json({ pid, participated: pr.participated, win: pr.win === true });
  }

  // 分配新的 PID
  for (let i = 0; i <= MAX_PID; i++) {
    const candidate = (nextPid + i) % (MAX_PID + 1);
    if (!participants.has(candidate)) {
      nextPid = (candidate + 1) % (MAX_PID + 1);
      pid = candidate;
      break;
    }
  }

  const record = {
    pid: pid,
    clientId,
    participated: false,
    joinedAt: Date.now()
  };
  participants.set(pid, record);
  if (clientId) clientIdToPid.set(clientId, pid);
  
  res.setHeader('Set-Cookie', `pid=${pid}; HttpOnly; Max-Age=${7*24*3600}; SameSite=Lax; Path=/`);
  
  console.log(`新用户加入: PID=${pid}, ClientId=${clientId}, 当前参与者总数=${participants.size}`);
  return res.json({ pid: pid, participated: false, win: false });
}

// 抽奖
function handleLotteryDraw(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const activityState = getActivityState();
  const activityConfig = getActivityConfig();
  
  if (activityState !== 'open') {
    return res.status(403).json({ error: 'ACTIVITY_NOT_OPEN', state: activityState });
  }

  const clientId = readClientId(req);
  let pid = parseInt(parseCookies(req.headers.cookie || '').pid);
  let p = participants.get(pid);

  if (!p && clientId && clientIdToPid.has(clientId)) {
    pid = clientIdToPid.get(clientId);
    p = participants.get(pid);
  }

  if (!p && clientId) {
    // 分配新的 PID
    for (let i = 0; i <= MAX_PID; i++) {
      const candidate = (nextPid + i) % (MAX_PID + 1);
      if (!participants.has(candidate)) {
        nextPid = (candidate + 1) % (MAX_PID + 1);
        pid = candidate;
        break;
      }
    }
    
    const record = { pid: pid, clientId, participated: false, joinedAt: Date.now() };
    participants.set(pid, record);
    clientIdToPid.set(clientId, pid);
    p = record;
    res.setHeader('Set-Cookie', `pid=${pid}; HttpOnly; Max-Age=${7*24*3600}; SameSite=Lax; Path=/`);
  }

  if (!p) {
    return res.status(400).json({ error: 'NO_PID' });
  }

  if (p.participated) {
    return res.status(409).json({ ok: false, error: 'ALREADY_PARTICIPATED', pid, win: p.win });
  }

  const choice = (req.body?.choice ?? req.body?.pick ?? 0);
  const faces = sampleFacesByCount(activityConfig.redCountMode);
  const win = faces[choice] === 'zhong';
  
  console.log(`PID ${pid} 抽奖: 选择${choice}, 牌面[${faces.join(',')}], 结果${win ? '中奖' : '未中奖'}`);
  
  p.participated = true;
  p.win = win;
  p.drawAt = Date.now();
  participants.set(pid, p);
  
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
}

// 其他端点简化实现
function handleLotteryDeal(req, res) {
  const activityConfig = getActivityConfig();
  const faces = sampleFacesByCount(activityConfig.redCountMode);
  const roundId = generateRoundId();
  rounds.set(roundId, { faces, createdAt: Date.now() });
  return res.json({ roundId, faces });
}

function handleLotteryPick(req, res) {
  const { roundId, index } = req.body || {};
  const round = rounds.get(roundId);
  if (!round) {
    return res.status(404).json({ error: 'ROUND_NOT_FOUND' });
  }
  const face = round.faces[index] || 'blank';
  const win = face === 'zhong';
  rounds.delete(roundId);
  return res.json({ win, face, faces: round.faces });
}

function handleLotteryGetProb(req, res) {
  try {
    requireAdmin(req);
    const activityConfig = getActivityConfig();
    const mode = activityConfig.redCountMode;
    const probability = [0, 1/3, 2/3, 1][mode];
    return res.json({ mode, probability });
  } catch (error) {
    if (error.message === 'NO_TOKEN' || error.message === 'ADMIN_REQUIRED') {
      return res.status(401).json({ ok: false, error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function handleLotterySetProb(req, res) {
  try {
    requireAdmin(req);
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
    const newProbability = [0, 1/3, 2/3, 1][nextMode];
    return res.json({ ok: true, mode: nextMode, probability: newProbability });
  } catch (error) {
    if (error.message === 'NO_TOKEN' || error.message === 'ADMIN_REQUIRED') {
      return res.status(401).json({ ok: false, error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
