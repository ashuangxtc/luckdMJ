import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// 活动状态表
export const events = pgTable("events", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("waiting"), // waiting/open/closed
  startAt: integer("start_at"), // 可选：活动开始时间 (毫秒)
  endAt: integer("end_at"),     // 可选：活动结束时间 (毫秒)
  updatedAt: integer("updated_at").notNull(),
});

// 抽奖记录表
export const draws = pgTable("draws", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: integer("ts").notNull(),
  userKey: text("user_key").notNull(), // hash(IP+UA) 或手机号
  ip: text("ip").notNull(),
  userAgent: text("ua").notNull(),
  result: text("result").notNull(), // "hongzhong" 或 "baiban"
  code: text("code"), // 中奖兑换码
  redeemed: boolean("redeemed").default(false),
});

// 系统配置表
export const configs = pgTable("configs", {
  id: text("id").primaryKey(),
  value: text("value").notNull(), // JSON字符串
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  updatedAt: true,
});

export const insertDrawSchema = createInsertSchema(draws).omit({
  id: true,
  timestamp: true,
  redeemed: true,
});

export const insertConfigSchema = createInsertSchema(configs);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

export type Draw = typeof draws.$inferSelect;
export type InsertDraw = z.infer<typeof insertDrawSchema>;

export type Config = typeof configs.$inferSelect;
export type InsertConfig = z.infer<typeof insertConfigSchema>;

// 活动状态枚举
export const ActivityStatus = {
  WAITING: "waiting" as const,
  OPEN: "open" as const,
  CLOSED: "closed" as const,
} as const;

export type ActivityStatusType = typeof ActivityStatus[keyof typeof ActivityStatus];
