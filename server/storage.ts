import { 
  type User, 
  type InsertUser, 
  type Event, 
  type InsertEvent, 
  type Draw, 
  type InsertDraw, 
  type Config, 
  type InsertConfig,
  ActivityStatus,
  type ActivityStatusType
} from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Event/Activity methods
  getEvent(id: string): Promise<Event | undefined>;
  getDefaultEvent(): Promise<Event>;
  updateEventStatus(status: ActivityStatusType): Promise<void>;
  updateEventWindow(startAt?: number, endAt?: number): Promise<void>;
  
  // Draw methods
  createDraw(draw: InsertDraw): Promise<Draw>;
  getUserDraw(userKey: string): Promise<Draw | undefined>;
  getDrawStats(): Promise<{
    totalParticipants: number;
    totalWinners: number;
    totalBagsGiven: number;
    todayStats: {
      participants: number;
      winners: number;
      bagsGiven: number;
    };
  }>;
  getAllDraws(): Promise<Draw[]>;
  
  // Config methods
  getConfig(id: string): Promise<Config | undefined>;
  setConfig(id: string, value: any): Promise<void>;
  getWinProbability(): Promise<number>;
  setWinProbability(probability: number): Promise<void>;
  
  // Participant management methods
  resetUserParticipation(userKey: string): Promise<boolean>;
  getAllParticipants(): Promise<Array<{
    userIdentifier: string;
    ipAddress: string;
    timestamp: number;
    result: string;
    status: string;
  }>>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private events: Map<string, Event>;
  private draws: Map<string, Draw>;
  private configs: Map<string, Config>;

  constructor() {
    this.users = new Map();
    this.events = new Map();
    this.draws = new Map();
    this.configs = new Map();
    
    // 初始化默认活动和配置
    this.initializeDefaults();
  }

  private initializeDefaults() {
    // 初始化默认活动
    const defaultEvent: Event = {
      id: "default",
      status: ActivityStatus.WAITING,
      startAt: null,
      endAt: null,
      updatedAt: Date.now()
    };
    this.events.set("default", defaultEvent);
    
    // 初始化默认配置
    this.configs.set("prob_hongzhong", { id: "prob_hongzhong", value: "0.10" });
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Event/Activity methods
  async getEvent(id: string): Promise<Event | undefined> {
    return this.events.get(id);
  }

  async getDefaultEvent(): Promise<Event> {
    const event = this.events.get("default");
    if (!event) {
      throw new Error("Default event not found");
    }
    return event;
  }

  async updateEventStatus(status: ActivityStatusType): Promise<void> {
    const event = await this.getDefaultEvent();
    const updatedEvent: Event = {
      ...event,
      status,
      updatedAt: Date.now()
    };
    this.events.set("default", updatedEvent);
  }

  async updateEventWindow(startAt?: number, endAt?: number): Promise<void> {
    const event = await this.getDefaultEvent();
    const updatedEvent: Event = {
      ...event,
      startAt: startAt || null,
      endAt: endAt || null,
      updatedAt: Date.now()
    };
    this.events.set("default", updatedEvent);
  }

  // Draw methods
  async createDraw(insertDraw: InsertDraw): Promise<Draw> {
    const id = randomUUID();
    const draw: Draw = {
      id,
      ...insertDraw,
      code: insertDraw.code || null,
      timestamp: Date.now(),
      redeemed: false
    };
    this.draws.set(id, draw);
    return draw;
  }

  async getUserDraw(userKey: string): Promise<Draw | undefined> {
    return Array.from(this.draws.values()).find(
      (draw) => draw.userKey === userKey,
    );
  }

  async getDrawStats(): Promise<{
    totalParticipants: number;
    totalWinners: number;
    totalBagsGiven: number;
    todayStats: {
      participants: number;
      winners: number;
      bagsGiven: number;
    };
  }> {
    const allDraws = Array.from(this.draws.values());
    const totalParticipants = allDraws.length;
    const totalWinners = allDraws.filter(draw => draw.result === "hongzhong").length;
    const totalBagsGiven = totalWinners; // 中奖即送出
    
    // 今日统计 (简化版，实际应该按日期过滤)
    const todayDraws = allDraws.filter(draw => {
      const today = new Date().toDateString();
      const drawDate = new Date(draw.timestamp).toDateString();
      return today === drawDate;
    });
    
    const todayParticipants = todayDraws.length;
    const todayWinners = todayDraws.filter(draw => draw.result === "hongzhong").length;
    const todayBagsGiven = todayWinners;

    return {
      totalParticipants,
      totalWinners,
      totalBagsGiven,
      todayStats: {
        participants: todayParticipants,
        winners: todayWinners,
        bagsGiven: todayBagsGiven,
      }
    };
  }

  async getAllDraws(): Promise<Draw[]> {
    return Array.from(this.draws.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  // Config methods
  async getConfig(id: string): Promise<Config | undefined> {
    return this.configs.get(id);
  }

  async setConfig(id: string, value: any): Promise<void> {
    this.configs.set(id, { id, value: JSON.stringify(value) });
  }

  async getWinProbability(): Promise<number> {
    const config = await this.getConfig("prob_hongzhong");
    return config ? parseFloat(config.value) : 0.10;
  }

  async setWinProbability(probability: number): Promise<void> {
    await this.setConfig("prob_hongzhong", probability);
  }

  // 重置参与者状态（删除其抽奖记录）
  async resetUserParticipation(userKey: string): Promise<boolean> {
    // 使用getUserDraw方法查找用户的draw记录
    const userDraw = await this.getUserDraw(userKey);
    
    if (userDraw) {
      this.draws.delete(userDraw.id);
      return true;
    }
    return false;
  }

  // 获取所有参与者列表（用于管理界面显示）
  async getAllParticipants(): Promise<Array<{
    userIdentifier: string;
    ipAddress: string;
    timestamp: number;
    result: string;
    status: string;
  }>> {
    const draws = Array.from(this.draws.values())
      .sort((a, b) => b.timestamp - a.timestamp);
    
    return draws.map(draw => ({
      userIdentifier: draw.userKey,
      ipAddress: draw.ip,
      timestamp: draw.timestamp,
      result: draw.result,
      status: draw.redeemed ? 'redeemed' : 'pending'
    }));
  }
}

export const storage = new MemStorage();
