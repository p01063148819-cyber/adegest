import { eq, inArray } from "drizzle-orm";
import {
  db,
  productsTable,
  productComponentsTable,
  comboOptionGroupsTable,
  comboOptionsTable,
  comboOptionComponentsTable,
} from "@workspace/db";

export interface ComboComponentRef {
  productId: number;
  quantity: number;
}

export interface ComboOptionRef {
  id: number;
  name: string;
  components: ComboComponentRef[];
}

export interface ComboOptionGroupRef {
  id: number;
  name: string;
  required: boolean;
  options: ComboOptionRef[];
}

export interface ComboTree {
  fixedComponents: ComboComponentRef[];
  optionGroups: ComboOptionGroupRef[];
}

export interface ComboComponentDetail extends ComboComponentRef {
  productName: string;
}

export interface ComboOptionDetail {
  id: number;
  name: string;
  components: ComboComponentDetail[];
}

export interface ComboOptionGroupDetail {
  id: number;
  name: string;
  required: boolean;
  options: ComboOptionDetail[];
}

export interface ComboDetail extends ComboTree {
  fixedComponents: ComboComponentDetail[];
  optionGroups: ComboOptionGroupDetail[];
}

// Loads the full component/group/option tree (with product names resolved)
// for a batch of combo product ids, in a fixed number of queries regardless
// of how many combos are requested (avoids N+1).
export async function loadComboTrees(comboIds: number[]): Promise<Map<number, ComboDetail>> {
  const trees = new Map<number, ComboDetail>();
  if (comboIds.length === 0) return trees;
  for (const id of comboIds) trees.set(id, { fixedComponents: [], optionGroups: [] });

  const fixedRows = await db
    .select({
      comboId: productComponentsTable.comboId,
      productId: productComponentsTable.componentProductId,
      productName: productsTable.name,
      quantity: productComponentsTable.quantity,
    })
    .from(productComponentsTable)
    .innerJoin(productsTable, eq(productComponentsTable.componentProductId, productsTable.id))
    .where(inArray(productComponentsTable.comboId, comboIds));

  for (const row of fixedRows) {
    trees.get(row.comboId)?.fixedComponents.push({ productId: row.productId, productName: row.productName, quantity: row.quantity });
  }

  const groupRows = await db
    .select()
    .from(comboOptionGroupsTable)
    .where(inArray(comboOptionGroupsTable.comboId, comboIds));

  const groupById = new Map<number, ComboOptionGroupDetail>();
  for (const group of groupRows) {
    const detail: ComboOptionGroupDetail = { id: group.id, name: group.name, required: group.required, options: [] };
    groupById.set(group.id, detail);
    trees.get(group.comboId)?.optionGroups.push(detail);
  }

  if (groupById.size > 0) {
    const optionRows = await db
      .select()
      .from(comboOptionsTable)
      .where(inArray(comboOptionsTable.groupId, [...groupById.keys()]));

    const optionById = new Map<number, ComboOptionDetail>();
    for (const option of optionRows) {
      const detail: ComboOptionDetail = { id: option.id, name: option.name, components: [] };
      optionById.set(option.id, detail);
      groupById.get(option.groupId)?.options.push(detail);
    }

    if (optionById.size > 0) {
      const componentRows = await db
        .select({
          optionId: comboOptionComponentsTable.optionId,
          productId: comboOptionComponentsTable.productId,
          productName: productsTable.name,
          quantity: comboOptionComponentsTable.quantity,
        })
        .from(comboOptionComponentsTable)
        .innerJoin(productsTable, eq(comboOptionComponentsTable.productId, productsTable.id))
        .where(inArray(comboOptionComponentsTable.optionId, [...optionById.keys()]));

      for (const row of componentRows) {
        optionById.get(row.optionId)?.components.push({ productId: row.productId, productName: row.productName, quantity: row.quantity });
      }
    }
  }

  return trees;
}

export interface ComboAvailability {
  tree: ComboDetail;
  availability: number;
}

// For a set of products (a subset of which may be combos), loads each combo's
// tree plus a batched live-stock lookup covering every component involved
// across all of them, and computes each combo's worst-case availability.
export async function buildComboAvailabilityContext(
  products: Array<{ id: number; isCombo: boolean }>,
): Promise<Map<number, ComboAvailability>> {
  const context = new Map<number, ComboAvailability>();
  const comboIds = products.filter((p) => p.isCombo).map((p) => p.id);
  if (comboIds.length === 0) return context;

  const trees = await loadComboTrees(comboIds);

  const allComponentIds = new Set<number>();
  for (const tree of trees.values()) {
    for (const id of collectComponentProductIds(tree)) allComponentIds.add(id);
  }

  const stockByProductId = new Map<number, number>();
  if (allComponentIds.size > 0) {
    const stockRows = await db
      .select({ id: productsTable.id, stockQuantity: productsTable.stockQuantity })
      .from(productsTable)
      .where(inArray(productsTable.id, [...allComponentIds]));
    for (const row of stockRows) stockByProductId.set(row.id, row.stockQuantity);
  }

  for (const comboId of comboIds) {
    const tree = trees.get(comboId) ?? { fixedComponents: [], optionGroups: [] };
    context.set(comboId, { tree, availability: computeComboAvailability(tree, stockByProductId) });
  }

  return context;
}

export function aggregateComponents(components: ComboComponentRef[]): Map<number, number> {
  const totals = new Map<number, number>();
  for (const component of components) {
    totals.set(component.productId, (totals.get(component.productId) ?? 0) + component.quantity);
  }
  return totals;
}

function limitForComponents(components: ComboComponentRef[], stockByProductId: Map<number, number>): number {
  if (components.length === 0) return Infinity;
  let limit = Infinity;
  for (const component of components) {
    const stock = stockByProductId.get(component.productId) ?? 0;
    const possible = Math.floor(stock / component.quantity);
    if (possible < limit) limit = possible;
  }
  return limit;
}

function limitForGroup(group: ComboOptionGroupRef, stockByProductId: Map<number, number>): number {
  if (group.options.length === 0) return 0;
  let limit = Infinity;
  for (const option of group.options) {
    const optionLimit = limitForComponents(option.components, stockByProductId);
    if (optionLimit < limit) limit = optionLimit;
  }
  return limit;
}

// Worst-case sellable quantity: fixed components always consumed, plus for every
// required group the option with the LEAST available stock (we don't know in
// advance which option the customer will pick, so we must assume the worst).
export function computeComboAvailability(combo: ComboTree, stockByProductId: Map<number, number>): number {
  const requiredGroups = combo.optionGroups.filter((g) => g.required);
  if (combo.fixedComponents.length === 0 && requiredGroups.length === 0) return 0;

  let limit = limitForComponents(combo.fixedComponents, stockByProductId);
  for (const group of requiredGroups) {
    const groupLimit = limitForGroup(group, stockByProductId);
    if (groupLimit < limit) limit = groupLimit;
  }
  return limit === Infinity ? 0 : limit;
}

export function collectComponentProductIds(combo: ComboTree): number[] {
  const ids = new Set<number>();
  for (const component of combo.fixedComponents) ids.add(component.productId);
  for (const group of combo.optionGroups) {
    for (const option of group.options) {
      for (const component of option.components) ids.add(component.productId);
    }
  }
  return [...ids];
}

export interface ComboSelectionOk {
  ok: true;
  components: ComboComponentRef[];
  selectedOptions: { groupId: number; groupName: string; optionId: number; optionName: string }[];
}

export interface ComboSelectionError {
  ok: false;
  error: string;
}

// Validates that selectedOptionIds provides exactly one option per required
// group and expands the choice into the full leaf-component consumption list
// (fixed components + the chosen options' components), for a single unit of the combo.
export function resolveComboSelection(
  combo: ComboTree,
  selectedOptionIds: number[],
): ComboSelectionOk | ComboSelectionError {
  const components: ComboComponentRef[] = [...combo.fixedComponents];
  const selectedOptions: ComboSelectionOk["selectedOptions"] = [];
  const selectedIdSet = new Set(selectedOptionIds);

  for (const group of combo.optionGroups) {
    const chosen = group.options.filter((option) => selectedIdSet.has(option.id));
    if (!group.required && chosen.length === 0) continue;
    if (chosen.length === 0) {
      return { ok: false, error: `Selecione uma opção para o grupo "${group.name}"` };
    }
    if (chosen.length > 1) {
      return { ok: false, error: `Apenas uma opção pode ser escolhida para o grupo "${group.name}"` };
    }
    const option = chosen[0];
    components.push(...option.components);
    selectedOptions.push({ groupId: group.id, groupName: group.name, optionId: option.id, optionName: option.name });
  }

  return { ok: true, components, selectedOptions };
}
