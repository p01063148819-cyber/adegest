import { pgTable, serial, text, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";

export const productComponentsTable = pgTable("produto_componentes", {
  id: serial("id").primaryKey(),
  comboId: integer("combo_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  componentProductId: integer("componente_produto_id").notNull().references(() => productsTable.id, { onDelete: "restrict" }),
  quantity: integer("quantidade").notNull().default(1),
});

export const comboOptionGroupsTable = pgTable("combo_grupos_opcao", {
  id: serial("id").primaryKey(),
  comboId: integer("combo_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  name: text("nome").notNull(),
  required: boolean("obrigatorio").notNull().default(true),
});

export const comboOptionsTable = pgTable("combo_opcoes", {
  id: serial("id").primaryKey(),
  groupId: integer("grupo_id").notNull().references(() => comboOptionGroupsTable.id, { onDelete: "cascade" }),
  name: text("nome").notNull(),
});

export const comboOptionComponentsTable = pgTable("combo_opcao_componentes", {
  id: serial("id").primaryKey(),
  optionId: integer("opcao_id").notNull().references(() => comboOptionsTable.id, { onDelete: "cascade" }),
  productId: integer("produto_id").notNull().references(() => productsTable.id, { onDelete: "restrict" }),
  quantity: integer("quantidade").notNull().default(1),
});

export const insertProductComponentSchema = createInsertSchema(productComponentsTable).omit({ id: true });
export const insertComboOptionGroupSchema = createInsertSchema(comboOptionGroupsTable).omit({ id: true });
export const insertComboOptionSchema = createInsertSchema(comboOptionsTable).omit({ id: true });
export const insertComboOptionComponentSchema = createInsertSchema(comboOptionComponentsTable).omit({ id: true });

export type InsertProductComponent = z.infer<typeof insertProductComponentSchema>;
export type InsertComboOptionGroup = z.infer<typeof insertComboOptionGroupSchema>;
export type InsertComboOption = z.infer<typeof insertComboOptionSchema>;
export type InsertComboOptionComponent = z.infer<typeof insertComboOptionComponentSchema>;

export type ProductComponent = typeof productComponentsTable.$inferSelect;
export type ComboOptionGroup = typeof comboOptionGroupsTable.$inferSelect;
export type ComboOption = typeof comboOptionsTable.$inferSelect;
export type ComboOptionComponent = typeof comboOptionComponentsTable.$inferSelect;
