import { participants, allocatePid, parseCookies, readClientId } from '../lib/state.js';

// 客户端ID到PID的映射（简化实现）
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
    const clientId = readClientId(req);
    let pid = parseInt(parseCookies(req.headers.cookie || '').pid);
    if (isNaN(pid)) pid = undefined;

    // 如果带了 clientId，优先用 clientId 找已存在的参与者
    if (clientId && clientIdToPid.has(clientId)) {
      const mappedPid = clientIdToPid.get(clientId);
      const p = participants.get(mappedPid);
      if (p) {
        // 回写 cookie，保持会话一致
        res.setHeader('Set-Cookie', `pid=${p.pid}; HttpOnly; Max-Age=${7*24*3600}; SameSite=Lax; Path=/`);
        return res.json({ pid: p.pid, participated: p.participated, win: p.win === true });
      } else {
        // 映射已失效，清除陈旧映射
        clientIdToPid.delete(clientId);
      }
    }

    if (pid != null && participants.has(pid)) {
      // 已有 pid，若此次带了 clientId，则建立关联
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
    
    // 7 天有效期
    res.setHeader('Set-Cookie', `pid=${newPid}; HttpOnly; Max-Age=${7*24*3600}; SameSite=Lax; Path=/`);
    
    return res.json({ pid: newPid, participated: false, win: false });
    
  } catch (error) {
    console.error('Join endpoint error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
