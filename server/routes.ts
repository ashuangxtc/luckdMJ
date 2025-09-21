import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ActivityStatus, insertDrawSchema, type ActivityStatusType } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";
import { store, getArrangementForRound } from "./state";

// 新的抽签数据结构
interface LotteryPlay {
  deviceId: string;
  result: '红中' | '白板';
  timestamp: number;
}

// 内存存储抽签记录
const playedDevices = new Set<string>();
const lotteryLog: LotteryPlay[] = [];

// 抽签配置
let lotteryConfig = {
  hongzhongPercent: 67, // 红中中奖概率百分比
  weights: {
    hongzhong: 2,
    baiban: 1
  }
};

// 管理员身份验证中间件
function requireAdmin(req: any, res: any, next: any) {
  const adminPassword = req.headers['x-admin-password'];
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  
  if (adminPassword !== 'admin123' && bearerToken !== 'admin123') {
    return res.status(401).json({ ok: false, msg: 'unauthorized' });
  }
  next();
}

// 生成用户唯一标识
function generateUserKey(ip: string, userAgent: string): string {
  return crypto.createHash('md5').update(ip + userAgent).digest('hex');
}

// 生成兑换码
function generateRedeemCode(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  const checksum = crypto.createHash('md5').update(`${date}${random}salt123`).digest('hex').substr(0, 4).toUpperCase();
  return `DM-${date}-${checksum}`;
}

// 检查活动当前状态（考虑时间窗口）
async function getActualActivityStatus(): Promise<ActivityStatusType> {
  const event = await storage.getDefaultEvent();
  const now = Date.now();
  let status: ActivityStatusType = event.status as ActivityStatusType;

  // 如果设置了开始时间且还未到开始时间，强制为waiting
  if (event.startAt && now < event.startAt) {
    status = ActivityStatus.WAITING;
  }
  
  // 如果在开始时间和结束时间之间，且状态不是closed，则为open
  if (event.startAt && now >= event.startAt && (!event.endAt || now <= event.endAt)) {
    status = (event.status === ActivityStatus.CLOSED ? ActivityStatus.CLOSED : ActivityStatus.OPEN);
  }
  
  // 如果设置了结束时间且已过结束时间，强制为closed
  if (event.endAt && now > event.endAt) {
    status = ActivityStatus.CLOSED;
  }

  return status;
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // 0. 健康检查路径
  app.get('/api/health', (req, res) => {
    res.json({ 
      ok: true, 
      message: 'Server is running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });
  
  // 1. 查询当前活动状态
  app.get('/api/status', async (req, res) => {
    try {
      const event = await storage.getDefaultEvent();
      const actualStatus = await getActualActivityStatus();
      
      res.json({
        ok: true,
        status: actualStatus,
        startAt: event.startAt,
        endAt: event.endAt
      });
    } catch (error) {
      res.status(500).json({ ok: false, msg: 'status unavailable' });
    }
  });

  // 2. 执行抽奖逻辑（必须在状态open时才允许）
  app.post('/api/draw', async (req, res) => {
    try {
      const actualStatus = await getActualActivityStatus();
      
      // 检查活动状态
      if (actualStatus !== ActivityStatus.OPEN) {
        return res.status(403).json({ 
          ok: false, 
          msg: actualStatus === ActivityStatus.WAITING ? 'not_started' : 'activity_ended' 
        });
      }

      const clientIP = req.ip || req.connection.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || '';
      const userKey = generateUserKey(clientIP, userAgent);

      // 检查用户是否已经参与过
      const existingDraw = await storage.getUserDraw(userKey);
      if (existingDraw) {
        return res.status(409).json({ ok: false, msg: 'already_participated' });
      }

      // 获取中奖概率
      const winProbability = await storage.getWinProbability();
      const isWinner = Math.random() < winProbability;
      
      // 创建抽奖记录
      const drawData = {
        userKey,
        ip: clientIP,
        userAgent,
        result: isWinner ? "hongzhong" : "baiban",
        code: isWinner ? generateRedeemCode() : undefined
      };

      const draw = await storage.createDraw(drawData);

      res.json({
        ok: true,
        win: isWinner,
        prize: drawData.result,
        code: draw.code
      });

    } catch (error) {
      console.error('Draw error:', error);
      res.status(500).json({ ok: false, msg: 'draw_error' });
    }
  });

  // 3. 管理员手动切换状态
  app.post('/api/admin/set-status', requireAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      
      if (!Object.values(ActivityStatus).includes(status)) {
        return res.status(400).json({ ok: false, msg: 'invalid_status' });
      }

      await storage.updateEventStatus(status);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ ok: false });
    }
  });

  // 4. 设置活动时间窗口
  app.post('/api/admin/set-window', requireAdmin, async (req, res) => {
    try {
      const { startAt, endAt } = req.body;
      
      await storage.updateEventWindow(
        startAt ? parseInt(startAt) : undefined,
        endAt ? parseInt(endAt) : undefined
      );
      
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ ok: false });
    }
  });

  // 5. 获取统计数据
  app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getDrawStats();
      const winProbability = await storage.getWinProbability();
      
      res.json({
        ok: true,
        ...stats,
        winRate: winProbability
      });
    } catch (error) {
      res.status(500).json({ ok: false });
    }
  });

  // 6. 导出CSV数据
  app.get('/api/admin/export', requireAdmin, async (req, res) => {
    try {
      const draws = await storage.getAllDraws();
      const winners = draws.filter(draw => draw.result === "hongzhong");
      
      // 构建CSV数据
      const csvHeader = "时间,兑换码,IP地址,浏览器信息,状态\n";
      const csvData = winners.map(draw => {
        const timestamp = new Date(draw.timestamp).toLocaleString('zh-CN');
        const status = draw.redeemed ? "已核销" : "未核销";
        return `"${timestamp}","${draw.code}","${draw.ip}","${draw.userAgent}","${status}"`;
      }).join("\n");
      
      const csv = csvHeader + csvData;
      const filename = `mahjong_lottery_${new Date().toISOString().slice(0, 10)}.csv`;
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send('\uFEFF' + csv); // 添加BOM以支持中文
    } catch (error) {
      res.status(500).json({ ok: false });
    }
  });

  // 7. 更新中奖概率
  app.post('/api/admin/config', requireAdmin, async (req, res) => {
    try {
      const { probability } = req.body;
      
      if (typeof probability !== 'number' || probability < 0 || probability > 1) {
        return res.status(400).json({ ok: false, msg: 'invalid_probability' });
      }

      await storage.setWinProbability(probability);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ ok: false });
    }
  });

  // 8. 获取参与者列表
  app.get('/api/admin/participants', requireAdmin, async (req, res) => {
    try {
      const participants = await storage.getAllParticipants();
      res.json({
        ok: true,
        participants
      });
    } catch (error) {
      res.status(500).json({ ok: false });
    }
  });

  // 9. 重置参与者状态
  app.post('/api/admin/reset-user', requireAdmin, async (req, res) => {
    try {
      const { userKey } = req.body;
      
      if (!userKey) {
        return res.status(400).json({ ok: false, msg: 'missing_user_key' });
      }

      const success = await storage.resetUserParticipation(userKey);
      
      if (success) {
        res.json({ ok: true, msg: 'user_reset_success' });
      } else {
        res.status(404).json({ ok: false, msg: 'user_not_found' });
      }
    } catch (error) {
      res.status(500).json({ ok: false });
    }
  });

  // 10. 批量重置所有参与者
  app.post('/api/admin/reset-all', requireAdmin, async (req, res) => {
    try {
      const participants = await storage.getAllParticipants();
      let resetCount = 0;
      
      for (const participant of participants) {
        const success = await storage.resetUserParticipation(participant.userIdentifier);
        if (success) resetCount++;
      }
      
      res.json({ 
        ok: true, 
        msg: 'reset_all_success',
        resetCount
      });
    } catch (error) {
      res.status(500).json({ ok: false });
    }
  });

  // 11. 新的抽签接口 - 所见即所得
  app.post('/api/lottery/draw', async (req, res) => {
    try {
      const { deviceId, roundId, index } = req.body || {};
      
      // 检查活动状态
      const actualStatus = await getActualActivityStatus();
      if (actualStatus !== ActivityStatus.OPEN) {
        return res.status(403).json({ error: 'NOT_OPEN' });
      }
      
      // 验证参数
      if (!deviceId || roundId !== store.roundId) {
        return res.status(400).json({ error: 'INVALID_ROUND' });
      }
      
      if (typeof index !== 'number' || index < 0 || index > 2) {
        return res.status(400).json({ error: 'INVALID_INDEX' });
      }
      
      // 检查是否已参与本轮
      if (store.played.get(deviceId) === roundId) {
        return res.status(409).json({ error: 'ALREADY_PLAYED' });
      }
      
      // 获取本轮牌面排列
      const faces = getArrangementForRound(roundId, store.config.hongzhongPercent);
      const result = faces[index];
      const isWinner = result === '红中';
      
      // 记录参与
      store.played.set(deviceId, roundId);
      store.history.push({
        deviceId,
        roundId,
        result,
        ts: Date.now()
      });
      
      res.json({ 
        isWinner,
        label: result
      });
      
    } catch (error) {
      console.error('Lottery draw error:', error);
      res.status(500).json({ error: 'DRAW_ERROR' });
    }
  });

  // 12. 获取抽签记录
  app.get('/api/lottery/played', requireAdmin, async (req, res) => {
    try {
      // 按时间倒序返回
      const sortedLog = [...store.history].sort((a, b) => b.ts - a.ts);
      res.json(sortedLog);
    } catch (error) {
      res.status(500).json({ error: 'FETCH_ERROR' });
    }
  });

  // 13. 重置抽签记录
  app.post('/api/lottery/admin/reset', requireAdmin, async (req, res) => {
    try {
      // 增加轮次ID
      store.roundId++;
      // 清空参与记录
      store.played.clear();
      // 删除旧轮次的排列
      store.arrangements.delete(store.roundId - 1);
      // 设置状态为开放
      store.state = 'open';
      // 记录重置时间
      store.resetAt = Date.now();
      
      res.json({ 
        ok: true,
        roundId: store.roundId
      });
    } catch (error) {
      res.status(500).json({ error: 'RESET_ERROR' });
    }
  });

  // 14. 获取抽签状态（健康检查）
  app.get('/api/lottery/status', async (req, res) => {
    try {
      const actualStatus = await getActualActivityStatus();
      res.json({ 
        state: actualStatus,
        roundId: store.roundId,
        resetAt: store.resetAt
      });
    } catch (error) {
      res.status(500).json({ error: 'STATUS_ERROR' });
    }
  });

  // 15. 获取牌面排列
  app.get('/api/lottery/arrangement', async (req, res) => {
    try {
      const faces = getArrangementForRound(store.roundId, store.config.hongzhongPercent);
      res.json({
        roundId: store.roundId,
        faces
      });
    } catch (error) {
      res.status(500).json({ error: 'ARRANGEMENT_ERROR' });
    }
  });

  // 16. 获取抽签配置
  app.get('/api/lottery/config', async (req, res) => {
    try {
      res.json(store.config);
    } catch (error) {
      res.status(500).json({ error: 'CONFIG_ERROR' });
    }
  });

  // 16. 管理员设置状态
  app.post('/api/lottery/admin/setState', requireAdmin, async (req, res) => {
    try {
      const { state } = req.body || {};
      
      if (!Object.values(ActivityStatus).includes(state)) {
        return res.status(400).json({ error: 'INVALID_STATE' });
      }

      await storage.updateEventStatus(state);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: 'STATE_UPDATE_ERROR' });
    }
  });

  // 17. 更新抽签配置
  app.post('/api/lottery/admin/config', requireAdmin, async (req, res) => {
    try {
      const { hongzhongPercent } = req.body || {};
      
      if (typeof hongzhongPercent === 'number' && hongzhongPercent >= 0 && hongzhongPercent <= 100) {
        store.config.hongzhongPercent = hongzhongPercent;
        res.json({ ok: true });
      } else {
        res.status(400).json({ error: 'INVALID_PERCENT' });
      }
    } catch (error) {
      res.status(500).json({ error: 'CONFIG_UPDATE_ERROR' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
