import crypto from "crypto";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Dreammore123';
const JWT_SECRET = process.env.JWT_SECRET || 'dreammore-lucky-mahjong-secret-2024';
const ADMIN_SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 小时

// 简单的 JWT 实现
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlDecode(str) {
  str += '='.repeat((4 - str.length % 4) % 4);
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
}

function createJWT(payload) {
  const header = {
    "alg": "HS256",
    "typ": "JWT"
  };
  
  const now = Date.now();
  const jwtPayload = {
    ...payload,
    iat: now,
    exp: now + ADMIN_SESSION_TTL_MS
  };
  
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(jwtPayload));
  
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyJWT(token) {
  try {
    const [encodedHeader, encodedPayload, signature] = token.split('.');
    
    if (!encodedHeader || !encodedPayload || !signature) {
      return null;
    }
    
    // 验证签名
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    if (signature !== expectedSignature) {
      return null;
    }
    
    // 解码载荷
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    
    // 检查过期时间
    if (Date.now() > payload.exp) {
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

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

export {
  ADMIN_PASSWORD,
  ADMIN_SESSION_TTL_MS,
  createJWT,
  verifyJWT,
  parseCookies
};