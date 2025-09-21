// 全局状态管理（简化版，使用环境变量持久化关键状态）

// 参与者类型定义
// type Participant = {
//   pid: number
//   clientId?: string
//   participated: boolean
//   win?: boolean
//   joinedAt: number
//   drawAt?: number
// }

// 活动状态：'waiting' | 'open' | 'closed'
// 从环境变量读取，默认为 'waiting'
const getActivityState = () => {
  return process.env.ACTIVITY_STATE || 'waiting';
};

// 活动配置
const getActivityConfig = () => {
  return {
    redCountMode: parseInt(process.env.RED_COUNT_MODE || '1') // 0/1/2/3 张红中
  };
};

// 内存存储（在 serverless 环境中每次调用都会重置）
const participants = new Map();
const rounds = new Map();
let nextPid = 0;
const MAX_PID = 1000;

// 生成牌面
function sampleFacesByCount(redCount) {
  const faces = Array(3).fill('blank');
  const indices = [0, 1, 2].sort(() => Math.random() - 0.5).slice(0, redCount);
  indices.forEach(i => faces[i] = 'zhong');
  
  console.log(`生成牌面: redCount=${redCount}, 排列=[${faces.join(',')}]`);
  return faces;
}

// 生成轮次ID
function generateRoundId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 分配参与者ID
function allocatePid() {
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

// Cookie 解析
function parseCookies(cookieString) {
  const cookies = {};
  if (cookieString) {
    cookieString.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = value;
      }
    });
  }
  return cookies;
}

// 从请求中读取客户端ID
function readClientId(req) {
  const h = (req.headers['x-client-id'] || req.headers['X-Client-Id'] || '');
  const q = (req.query?.cid || req.body?.cid);
  const cid = (h || q || '').toString().trim();
  return cid || undefined;
}

export {
  getActivityState,
  getActivityConfig,
  participants,
  rounds,
  nextPid,
  MAX_PID,
  sampleFacesByCount,
  generateRoundId,
  allocatePid,
  parseCookies,
  readClientId
};
