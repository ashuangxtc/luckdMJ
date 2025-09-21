import { verifyJWT, parseCookies } from './lib/auth.js';
import { getActivityState, getActivityConfig, participants, rounds, allocatePid, sampleFacesByCount, generateRoundId, readClientId } from './lib/state.js';

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

  try {
    const path = req.url || '';
    console.log('Lottery API called:', req.method, path);

    // 路由分发
    if (path.includes('/status')) {
      return handleStatus(req, res);
    } else if (path.includes('/join')) {
      return handleJoin(req, res);
    } else if (path.includes('/draw')) {
      return handleDraw(req, res);
    } else if (path.includes('/deal')) {
      return handleDeal(req, res);
    } else if (path.includes('/pick')) {
      return handlePick(req, res);
    } else if (path.includes('/admin/get-prob')) {
      return handleGetProb(req, res);
    } else if (path.includes('/admin/set-prob')) {
      return handleSetProb(req, res);
    } else {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
  } catch (error) {
    console.error('Lottery API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

// 状态查询
function handleStatus(req, res) {
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
function handleJoin(req, res) {
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
    return res.json({ pid, participated: pr.participated, win: pr.win === true });
  }

  const newPid = allocatePid();
  const record = {
    pid: newPid,
    clientId,
    participated: false,
    joinedAt: Date.now()
  };
  participants.set(newPid, record);
  if (clientId) clientIdToPid.set(clientId, newPid);
  
  res.setHeader('Set-Cookie', `pid=${newPid}; HttpOnly; Max-Age=${7*24*3600}; SameSite=Lax; Path=/`);
  return res.json({ pid: newPid, participated: false, win: false });
}

// 抽奖
function handleDraw(req, res) {
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
    const newPid = allocatePid();
    const record = { pid: newPid, clientId, participated: false, joinedAt: Date.now() };
    participants.set(newPid, record);
    clientIdToPid.set(clientId, newPid);
    pid = newPid;
    p = record;
    res.setHeader('Set-Cookie', `pid=${newPid}; HttpOnly; Max-Age=${7*24*3600}; SameSite=Lax; Path=/`);
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
  
  console.log(`PID ${pid} 抽奖详情: 选择位置${choice}, 牌面[${faces.join(',')}], 选中${faces[choice]}, 结果${win ? '中奖' : '未中奖'}`);
  
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

// 发牌
function handleDeal(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const activityState = getActivityState();
  if (activityState !== 'open') {
    return res.status(403).json({ error: 'ACTIVITY_NOT_OPEN' });
  }
  
  const activityConfig = getActivityConfig();
  const faces = sampleFacesByCount(activityConfig.redCountMode);
  const roundId = generateRoundId();
  rounds.set(roundId, { faces, createdAt: Date.now() });
  
  console.log(`发牌: roundId=${roundId}, faces=[${faces.join(',')}]`);
  return res.json({ roundId, faces });
}

// 选牌
function handlePick(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { roundId, index } = req.body || {};
  const round = rounds.get(roundId);
  if (!round) {
    return res.status(404).json({ error: 'ROUND_NOT_FOUND' });
  }
  
  const face = round.faces[index] || 'blank';
  const win = face === 'zhong';
  rounds.delete(roundId);
  
  console.log(`选牌: roundId=${roundId}, index=${index}, face=${face}, win=${win}`);
  return res.json({ win, face, faces: round.faces });
}

// 获取概率设置（需要管理员权限）
function handleGetProb(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
}

// 设置概率（需要管理员权限）
function handleSetProb(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

  console.log(`管理员更新红中张数: -> ${nextMode}`);
  const newProbability = [0, 1/3, 2/3, 1][nextMode];
  return res.json({ ok: true, mode: nextMode, probability: newProbability });
}
