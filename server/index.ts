import express, { type Request, Response, NextFunction } from "express";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

type Participant = {
  pid: number
  clientId?: string
  participated: boolean
  win?: boolean
  joinedAt: number
  drawAt?: number
}

type ActivityState = 'waiting' | 'open' | 'closed'

type ActivityConfig = {
  hongzhongPercent: number
}

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// 仅开发环境开 CORS（生产要收紧）
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Client-Id');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });
}

// 内存存储
const participants = new Map<number, Participant>();
const clientIdToPid = new Map<string, number>();
// 简易管理员会话：token -> 过期时间戳
const adminSessions = new Map<string, number>();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Dreammore123';
const ADMIN_SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 小时
function readClientId(req: Request): string | undefined {
  const h = (req.headers['x-client-id'] || req.headers['X-Client-Id'] || '') as string;
  const q = (req.query?.cid || req.body?.cid) as string | undefined;
  const cid = (h || q || '').toString().trim();
  return cid || undefined;
}
let nextPid = 0;
const MAX_PID = 1000;

// 活动状态
let activityState: ActivityState = 'waiting';
let activityConfig = {
  redCountMode: 1  // 红中张数：0/1/2/3
};

// 简单直观的红中张数控制
function sampleFacesByCount(redCount: number): ('zhong'|'blank')[] {
  const faces: ('zhong'|'blank')[] = Array(3).fill('blank');
  const indices = [0, 1, 2].sort(() => Math.random() - 0.5).slice(0, redCount);
  indices.forEach(i => faces[i] = 'zhong');
  
  log(`生成牌面: redCount=${redCount}, 排列=[${faces.join(',')}]`);
  return faces;
}

// 当前轮次数据
const rounds = new Map<string, { faces: ('zhong'|'blank')[], createdAt: number }>();

// 生成唯一ID
function generateRoundId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function allocatePid(): number {
  // 简单循环找到一个未使用或可复用的 pid
  for (let i = 0; i <= MAX_PID; i++) {
    const candidate = (nextPid + i) % (MAX_PID + 1);
    const p = participants.get(candidate);
    if (!p) {
      nextPid = (candidate + 1) % (MAX_PID + 1);
      return candidate;
    }
  }
  // 满了也循环使用
  const candidate = nextPid;
  nextPid = (nextPid + 1) % (MAX_PID + 1);
  return candidate;
}

// 健康检查端点
app.get('/api/health', (_req, res) => {
  res.json({ 
    ok: true, 
    ts: Date.now(), 
    env: process.env.NODE_ENV || 'dev',
    message: 'Server is healthy'
  });
});

// 管理员登录/登出/状态
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (String(password || '') !== String(ADMIN_PASSWORD)) {
    return res.status(401).json({ ok:false, error:'INVALID_PASSWORD' });
  }
  const token = crypto.randomUUID();
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
  adminSessions.set(token, expiresAt);
  res.cookie('admin_session', token, { httpOnly: true, maxAge: ADMIN_SESSION_TTL_MS, sameSite: 'lax' });
  res.json({ ok:true, expiresAt });
});

app.post('/api/admin/logout', (req, res) => {
  const t = req.cookies?.admin_session as string | undefined;
  if (t) adminSessions.delete(t);
  res.clearCookie('admin_session');
  res.json({ ok:true });
});

app.get('/api/admin/me', (req, res) => {
  const t = req.cookies?.admin_session as string | undefined;
  if (!t || !adminSessions.has(t)) return res.status(401).json({ ok:false });
  const expiresAt = adminSessions.get(t)!;
  if (Date.now() > expiresAt) {
    adminSessions.delete(t);
    res.clearCookie('admin_session');
    return res.status(401).json({ ok:false, error:'SESSION_EXPIRED' });
  }
  res.json({ ok:true, expiresAt });
});

function requireAdmin(req: Request, res: Response, next: NextFunction){
  const t = req.cookies?.admin_session as string | undefined;
  if (!t || !adminSessions.has(t)) return res.status(401).json({ ok:false, error:'ADMIN_REQUIRED' });
  const expiresAt = adminSessions.get(t)!;
  if (Date.now() > expiresAt) {
    adminSessions.delete(t);
    res.clearCookie('admin_session');
    return res.status(401).json({ ok:false, error:'SESSION_EXPIRED' });
  }
  // 滑动续期：访问刷新过期时间
  adminSessions.set(t, Date.now() + ADMIN_SESSION_TTL_MS);
  next();
}

// 分配/返回 pid（用户进入页面时触发）
app.post('/api/lottery/join', (req, res) => {
  const clientId = readClientId(req);
  let pid = Number(req.cookies?.pid);
  if (Number.isNaN(pid)) pid = undefined as any;

  // 如果带了 clientId，优先用 clientId 找已存在的参与者
  if (clientId && clientIdToPid.has(clientId)) {
    const mappedPid = clientIdToPid.get(clientId)!;
    const p = participants.get(mappedPid);
    if (p) {
      // 回写 cookie，保持会话一致
      res.cookie('pid', String(p.pid), { httpOnly: true, maxAge: 7*24*3600*1000, sameSite: 'lax' });
      return res.json({ pid: p.pid, participated: p.participated, win: p.win === true });
    } else {
      // 映射已失效（例如被 reset-all 清空），清除陈旧映射
      clientIdToPid.delete(clientId);
    }
  }

  if (pid != null && participants.has(pid)) {
    // 已有 pid，若此次带了 clientId，则建立关联
    if (clientId) {
      const existed = participants.get(pid)!;
      existed.clientId = clientId;
      participants.set(pid, existed);
      clientIdToPid.set(clientId, pid);
    }
    const pr = participants.get(pid)!;
    return res.json({ pid, participated: pr.participated, win: pr.win === true });
  }

  const newPid = allocatePid();
  const record: Participant = {
    pid: newPid,
    clientId,
    participated: false,
    joinedAt: Date.now()
  };
  participants.set(newPid, record);
  if (clientId) clientIdToPid.set(clientId, newPid);
  
  // 7 天；生产环境请加 secure/sameSite
  res.cookie('pid', String(newPid), { 
    httpOnly: true, 
    maxAge: 7 * 24 * 3600 * 1000,
    sameSite: 'lax'
  });
  
  return res.json({ pid: newPid, participated: false, win: false });
});

// 新API: 发牌
app.post('/api/lottery/deal', (req, res) => {
  if (activityState !== 'open') {
    return res.status(403).json({ error: 'ACTIVITY_NOT_OPEN' });
  }
  
  const faces = sampleFacesByCount(activityConfig.redCountMode);
  const roundId = generateRoundId();
  rounds.set(roundId, { faces, createdAt: Date.now() });
  
  log(`发牌: roundId=${roundId}, faces=[${faces.join(',')}], redCountMode=${activityConfig.redCountMode}`);
  res.json({ roundId, faces });
});

// 新API: 选牌
app.post('/api/lottery/pick', (req, res) => {
  const { roundId, index } = req.body || {};
  const round = rounds.get(roundId);
  if (!round) {
    return res.status(404).json({ error: 'ROUND_NOT_FOUND' });
  }
  
  const face = round.faces[index] || 'blank';
  const win = face === 'zhong';
  rounds.delete(roundId); // 用一次即废，防止复用
  
  log(`选牌: roundId=${roundId}, index=${index}, face=${face}, win=${win}`);
  res.json({ win, face, faces: round.faces });
});

// 兼容旧API: 抽奖（只允许一次）
app.post('/api/lottery/draw', (req, res) => {
  // 检查活动状态
  if (activityState !== 'open') {
    return res.status(403).json({ error: 'ACTIVITY_NOT_OPEN', state: activityState });
  }

  // 允许通过 clientId 识别设备，避免前端因代理导致 cookie 丢失
  const clientId = readClientId(req);
  let pid = Number(req.cookies?.pid);
  let p: Participant | undefined = participants.get(pid);

  if (!p && clientId && clientIdToPid.has(clientId)) {
    pid = clientIdToPid.get(clientId)!;
    p = participants.get(pid);
  }

  // 如仍不存在且提供了 clientId，则为其分配一个参与者记录
  if (!p && clientId) {
    const newPid = allocatePid();
    const record: Participant = { pid: newPid, clientId, participated: false, joinedAt: Date.now() };
    participants.set(newPid, record);
    clientIdToPid.set(clientId, newPid);
    pid = newPid;
    p = record;
    // 写入 cookie，后续请求可复用
    res.cookie('pid', String(newPid), { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000, sameSite: 'lax' });
  }

  if (!p) {
    return res.status(400).json({ error: 'NO_PID' });
  }

  if (p.participated) {
    return res.status(409).json({ ok:false, error: 'ALREADY_PARTICIPATED', pid, win: p.win });
  }

  // 获取选择的牌索引（兼容 pick 字段）
  const choice = (req.body?.choice ?? req.body?.pick ?? 0) as number;
  
  // 生成新的牌面排列
  const faces = sampleFacesByCount(activityConfig.redCountMode);
  const win = faces[choice] === 'zhong';
  
  log(`PID ${pid} 抽奖详情: 选择位置${choice}, 牌面[${faces.join(',')}], 选中${faces[choice]}, 结果${win ? '中奖' : '未中奖'}, redCountMode=${activityConfig.redCountMode}`);
  
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
});

// 活动状态接口
app.get('/api/lottery/status', (_req, res) => {
  res.json({ 
    open: activityState === 'open',
    state: activityState,
    redCountMode: activityConfig.redCountMode,
    config: activityConfig,
    stats: {
      totalParticipants: participants.size,
      participated: Array.from(participants.values()).filter(p => p.participated).length,
      winners: Array.from(participants.values()).filter(p => p.win === true).length
    }
  });
});

app.get('/api/lottery/config', (_req, res) => {
  res.json(activityConfig);
});

// —— 管理端 ——

// 活动状态控制
app.post('/api/admin/set-state', requireAdmin, (req, res) => {
  const { state } = req.body;
  if (['waiting', 'open', 'closed'].includes(state)) {
    const prevState = activityState;
    activityState = state;
    
    log(`管理员设置活动状态: ${prevState} -> ${state}`);
    res.json({ ok: true, state: activityState });
  } else {
    res.status(400).json({ error: 'INVALID_STATE' });
  }
});

// 新API: 配置更新 (支持 redCountMode 0|1|2|3)
app.post('/api/lottery/config', requireAdmin, (req, res) => {
  const { redCountMode } = req.body;
  if ([0, 1, 2, 3].includes(Number(redCountMode))) {
    const prevMode = activityConfig.redCountMode;
    activityConfig.redCountMode = Number(redCountMode);
    
    log(`管理员更新红中张数: ${prevMode} -> ${redCountMode}`);
    res.json({ ok: true, redCountMode: activityConfig.redCountMode });
  } else {
    res.status(400).json({ error: 'redCountMode must be 0|1|2|3' });
  }
});

// 兼容旧API: 配置更新
app.post('/api/admin/config', requireAdmin, (req, res) => {
  const { hongzhongPercent, winRate, redCountMode } = req.body;
  
  if ([0, 1, 2, 3].includes(Number(redCountMode))) {
    // 新格式：直接使用 redCountMode
    const prevMode = activityConfig.redCountMode;
    activityConfig.redCountMode = Number(redCountMode);
    log(`管理员更新红中张数: ${prevMode} -> ${redCountMode} (新格式)`);
    res.json({ ok: true, config: activityConfig });
  } else if (typeof hongzhongPercent === 'number' && hongzhongPercent >= 0 && hongzhongPercent <= 100) {
    // 旧格式：转换百分比为红中张数（简化映射）
    let newMode = 1; // 默认1张
    if (hongzhongPercent <= 0) newMode = 0;
    else if (hongzhongPercent >= 100) newMode = 3;
    else if (hongzhongPercent >= 66) newMode = 2;
    else newMode = 1;
    
    const prevMode = activityConfig.redCountMode;
    activityConfig.redCountMode = newMode;
    log(`管理员更新红中张数: ${prevMode} -> ${newMode} (旧格式 ${hongzhongPercent}%)`);
    res.json({ ok: true, config: { ...activityConfig, hongzhongPercent } });
  } else {
    res.status(400).json({ error: 'INVALID_CONFIG' });
  }
});

// —— 概率配置（新接口，优先支持 mode，兼容 probability） ——
// GET: 返回 { mode, probability }
app.get('/api/lottery/admin/get-prob', requireAdmin, (req, res) => {
  const mode = activityConfig.redCountMode as 0|1|2|3;
  const probability = [0, 1/3, 2/3, 1][mode];
  res.json({ mode, probability });
});

// POST: 接收 { mode?:0|1|2|3, probability?:number }
app.post('/api/lottery/admin/set-prob', requireAdmin, (req, res) => {
  const { mode, probability } = req.body || {};

  let nextMode: 0|1|2|3 | undefined;
  if ([0,1,2,3].includes(Number(mode))) {
    nextMode = Number(mode) as 0|1|2|3;
  } else if (typeof probability === 'number') {
    const p = Math.max(0, Math.min(1, Number(probability)));
    nextMode = (p <= 0.01 ? 0 : p < 0.5 ? 1 : p < 0.99 ? 2 : 3) as 0|1|2|3;
  }

  if (nextMode === undefined) {
    return res.status(400).json({ error: 'need mode (0|1|2|3) or probability (0~1)' });
  }

  const prevMode = activityConfig.redCountMode;
  activityConfig.redCountMode = nextMode;
  const newProbability = [0, 1/3, 2/3, 1][nextMode];
  log(`管理员更新红中张数(新接口): ${prevMode} -> ${nextMode}`);
  res.json({ ok: true, mode: nextMode, probability: newProbability });
});

// 列表（简单返回内存数据）
app.get('/api/admin/participants', requireAdmin, (_req, res) => {
  const all = Array.from(participants.values())
    .sort((a, b) => a.pid - b.pid)
    .map(p => ({
      ...p,
      clientIdShort3: p.clientId ? (p.clientId.slice(-3).padStart(3,'0')) : null,
      status: p.participated ? (p.win ? '已中奖' : '未中奖') : '未参与',
      joinTime: new Date(p.joinedAt).toLocaleString('zh-CN'),
      drawTime: p.drawAt ? new Date(p.drawAt).toLocaleString('zh-CN') : null
    }));
  
  res.json({ 
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
});

// 单个重置
app.post('/api/admin/reset/:pid', requireAdmin, (req, res) => {
  const pid = Number(req.params.pid);
  if (participants.has(pid)) {
    const existed = participants.get(pid)!;
    participants.set(pid, {
      pid,
      clientId: existed.clientId,
      participated: false,
      joinedAt: existed.joinedAt,
      win: undefined,
      drawAt: undefined
    });
    log(`管理员重置PID ${pid}`);
    return res.json({ ok: true, pid, message: `已重置参与者 ${pid}` });
  }
  // 不存在则创建空号位
  participants.set(pid, { pid, participated: false, joinedAt: Date.now() });
  res.json({ ok: true, pid, message: `已创建参与者 ${pid}` });
});

// 全量重置
app.post('/api/admin/reset-all', requireAdmin, (_req, res) => {
  participants.clear();
  nextPid = 0;
  rounds.clear(); // 清理所有轮次
  clientIdToPid.clear(); // 清理设备映射，避免陈旧 pid 阻塞重入
  log('管理员重置所有数据');
  res.json({ ok: true });
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Default to 8080 if not specified.
  // this serves both the API and the client.
  const port = parseInt(process.env.PORT || '8080', 10);
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
    log(`Health check: http://127.0.0.1:${port}/api/health`);
  });
})();
