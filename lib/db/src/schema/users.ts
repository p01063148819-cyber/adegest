import { pgTable, pgEnum, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", ["admin", "vendedor"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  role: userRoleEnum("role").notNull().unique(),
  senhaHash: text("senha_hash"),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, criadoEm: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
export type UserRole = (typeof userRoleEnum.enumValues)[number];
