import { Router, type IRouter } from "express";
import { eq, and, gte, lte, inArray, sql } from "drizzle-orm";
import {
  db,
  salesTable,
  saleItemsTable,
  saleItemComponentsTable,
  productsTable,
  stockMovementsTable,
  comboOptionsTable,
  comboOptionGroupsTable,
} from "@workspace/db";
import {
  CreateSaleBody,
  GetSaleParams,
  CancelSaleParams,
  ListSalesQueryParams,
} from "@workspace/api-zod";
import { loadComboTrees, resolveComboSelection } from "../lib/comboStock";

const router: IRouter = Router();

function formatSale(s: Record<string, unknown>) {
  return {
    ...s,
    total: Number(s.total),
    discount: Number(s.discount),
  };
}

function formatSaleItem(item: Record<string, unknown>) {
  return {
    ...item,
    unitPrice: Number(item.unitPrice ?? item.unit_price),
    discount: Number(item.discount),
    subtotal: Number(item.subtotal),
  };
}

router.get("/sales", async (req, res): Promise<void> => {
  const query = ListSalesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { startDate, endDate, status } = query.data;
  const conditions = [];
  if (startDate) conditions.push(gte(salesTable.createdAt, new Date(startDate as string)));
  if (endDate) conditions.push(lte(salesTable.createdAt, new Date(endDate as string)));
  if (status) conditions.push(eq(salesTable.status, status as string));

  const sales = await db
    .select()
    .from(salesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${salesTable.createdAt} DESC`);

  res.json(sales.map(formatSale));
});

router.post("/sales", async (req, res): Promise<void> => {
  if (req.user?.role === "admin") {
    res.status(403).json({ error: "Admin não pode registrar vendas" });
    return;
  }

  const parsed = CreateSaleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { paymentMethod, discount = 0, notes, items } = parsed.data;
  if (items.length === 0) {
    res.status(400).json({ error: "A venda precisa ter pelo menos um item" });
    return;
  }

  const productIds = [...new Set(items.map((item) => item.productId))];
  const cartProducts = await db.select().from(productsTable).where(inArray(productsTable.id, productIds));
  const productById = new Map(cartProducts.map((p) => [p.id, p]));

  for (const item of items) {
    if (!productById.has(item.productId)) {
      res.status(400).json({ error: `Produto ${item.productId} não encontrado` });
      return;
    }
  }

  const comboIds = productIds.filter((id) => productById.get(id)!.isCombo);
  const comboTrees = await loadComboTrees(comboIds);

  interface ResolvedItem {
    productId: number;
    name: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    subtotal: number;
    selectedOptionIds: number[] | null;
    selectedOptions: { groupId: number; groupName: string; optionId: number; optionName: string }[];
    components: { productId: number; quantity: number }[];
  }

  const resolvedItems: ResolvedItem[] = [];

  for (const item of items) {
    const product = productById.get(item.productId)!;
    const unitPrice = Number(product.salePrice);
    const itemDiscount = item.discount ?? 0;
    const subtotal = unitPrice * item.quantity - itemDiscount;

    let components: { productId: number; quantity: number }[];
    let selectedOptions: ResolvedItem["selectedOptions"] = [];
    let selectedOptionIds: number[] | null = null;

    if (product.isCombo) {
      const tree = comboTrees.get(product.id) ?? { fixedComponents: [], optionGroups: [] };
      const selection = resolveComboSelection(tree, item.selectedOptionIds ?? []);
      if (!selection.ok) {
        res.status(400).json({ error: `"${product.name}": ${selection.error}` });
        return;
      }
      components = selection.components.map((c) => ({ productId: c.productId, quantity: c.quantity * item.quantity }));
      selectedOptions = selection.selectedOptions;
      selectedOptionIds = selection.selectedOptions.map((o) => o.optionId);
    } else {
      components = [{ productId: product.id, quantity: item.quantity }];
    }

    resolvedItems.push({
      productId: product.id,
      name: product.name,
      quantity: item.quantity,
      unitPrice,
      discount: itemDiscount,
      subtotal,
      selectedOptionIds,
      selectedOptions,
      components,
    });
  }

  // Aggregate consumption across the whole cart before checking stock — two lines
  // (two combos, or a combo plus a plain product) can compete for the same ingredient.
  const totalConsumption = new Map<number, number>();
  for (const item of resolvedItems) {
    for (const component of item.components) {
      totalConsumption.set(component.productId, (totalConsumption.get(component.productId) ?? 0) + component.quantity);
    }
  }

  const involvedIds = [...totalConsumption.keys()];
  const stockRows = await db
    .select({ id: productsTable.id, name: productsTable.name, stockQuantity: productsTable.stockQuantity })
    .from(productsTable)
    .where(inArray(productsTable.id, involvedIds));
  const stockById = new Map(stockRows.map((r) => [r.id, r]));

  const insufficient: string[] = [];
  for (const [productId, needed] of totalConsumption) {
    const row = stockById.get(productId);
    const available = row?.stockQuantity ?? 0;
    if (available < needed) {
      insufficient.push(`"${row?.name ?? productId}" (disponível: ${available}, necessário: ${needed})`);
    }
  }
  if (insufficient.length > 0) {
    res.status(400).json({ error: `Estoque insuficiente para: ${insufficient.join(", ")}` });
    return;
  }

  const subtotalSum = resolvedItems.reduce((acc, item) => acc + item.subtotal, 0);
  const total = subtotalSum - Number(discount);

  const sale = await db.transaction(async (tx) => {
    const [insertedSale] = await tx
      .insert(salesTable)
      .values({
        total: total.toString(),
        discount: discount.toString(),
        paymentMethod,
        status: "confirmed",
        notes: notes ?? null,
      })
      .returning();

    for (const item of resolvedItems) {
      const [insertedItem] = await tx
        .insert(saleItemsTable)
        .values({
          saleId: insertedSale.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toString(),
          discount: item.discount.toString(),
          subtotal: item.subtotal.toString(),
          selectedOptionIds: item.selectedOptionIds,
        })
        .returning();

      const optionsLabel = item.selectedOptions.length > 0 ? ` (${item.selectedOptions.map((o) => o.optionName).join(", ")})` : "";

      for (const component of item.components) {
        await tx.insert(saleItemComponentsTable).values({
          saleItemId: insertedItem.id,
          componentProductId: component.productId,
          quantity: component.quantity,
        });

        await tx
          .update(productsTable)
          .set({ stockQuantity: sql`${productsTable.stockQuantity} - ${component.quantity}`, updatedAt: new Date() })
          .where(eq(productsTable.id, component.productId));

        await tx.insert(stockMovementsTable).values({
          productId: component.productId,
          type: "sale",
          quantity: -component.quantity,
          notes: `Venda #${insertedSale.id} — ${item.name}${optionsLabel}`,
        });
      }
    }

    return insertedSale;
  });

  res.status(201).json(formatSale(sale as Record<string, unknown>));
});

router.get("/sales/:id", async (req, res): Promise<void> => {
  const params = GetSaleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, params.data.id));
  if (!sale) {
    res.status(404).json({ error: "Sale not found" });
    return;
  }

  const items = await db
    .select({
      id: saleItemsTable.id,
      saleId: saleItemsTable.saleId,
      productId: saleItemsTable.productId,
      productName: productsTable.name,
      quantity: saleItemsTable.quantity,
      unitPrice: saleItemsTable.unitPrice,
      discount: saleItemsTable.discount,
      subtotal: saleItemsTable.subtotal,
      selectedOptionIds: saleItemsTable.selectedOptionIds,
    })
    .from(saleItemsTable)
    .leftJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
    .where(eq(saleItemsTable.saleId, params.data.id));

  const allOptionIds = [...new Set(items.flatMap((item) => item.selectedOptionIds ?? []))];
  const optionDetails = new Map<number, { groupId: number; groupName: string; optionId: number; optionName: string }>();
  if (allOptionIds.length > 0) {
    const rows = await db
      .select({
        optionId: comboOptionsTable.id,
        optionName: comboOptionsTable.name,
        groupId: comboOptionGroupsTable.id,
        groupName: comboOptionGroupsTable.name,
      })
      .from(comboOptionsTable)
      .innerJoin(comboOptionGroupsTable, eq(comboOptionsTable.groupId, comboOptionGroupsTable.id))
      .where(inArray(comboOptionsTable.id, allOptionIds));
    for (const row of rows) optionDetails.set(row.optionId, row);
  }

  res.json({
    ...formatSale(sale as Record<string, unknown>),
    items: items.map((item) => ({
      ...formatSaleItem(item as Record<string, unknown>),
      productName: item.productName ?? "Produto removido",
      selectedOptions: (item.selectedOptionIds ?? []).map((id) => optionDetails.get(id)).filter((o): o is NonNullable<typeof o> => Boolean(o)),
    })),
  });
});

router.post("/sales/:id/cancel", async (req, res): Promise<void> => {
  const params = CancelSaleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, params.data.id));
  if (!sale) {
    res.status(404).json({ error: "Sale not found" });
    return;
  }

  if (sale.status === "cancelled") {
    res.status(400).json({ error: "Venda já cancelada" });
    return;
  }

  let restockRows = await db
    .select({
      componentProductId: saleItemComponentsTable.componentProductId,
      quantity: saleItemComponentsTable.quantity,
    })
    .from(saleItemComponentsTable)
    .innerJoin(saleItemsTable, eq(saleItemComponentsTable.saleItemId, saleItemsTable.id))
    .where(eq(saleItemsTable.saleId, params.data.id));

  // Sales created before sale_item_components existed have no rows here — fall
  // back to restoring directly onto the sale item's own product, as before.
  if (restockRows.length === 0) {
    const legacyItems = await db.select().from(saleItemsTable).where(eq(saleItemsTable.saleId, params.data.id));
    restockRows = legacyItems.map((item) => ({ componentProductId: item.productId, quantity: item.quantity }));
  }

  const updated = await db.transaction(async (tx) => {
    for (const row of restockRows) {
      await tx
        .update(productsTable)
        .set({ stockQuantity: sql`${productsTable.stockQuantity} + ${row.quantity}`, updatedAt: new Date() })
        .where(eq(productsTable.id, row.componentProductId));

      await tx.insert(stockMovementsTable).values({
        productId: row.componentProductId,
        type: "cancellation",
        quantity: row.quantity,
        notes: `Estorno da venda #${sale.id}`,
      });
    }

    const [result] = await tx
      .update(salesTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(salesTable.id, params.data.id))
      .returning();

    return result;
  });

  res.json(formatSale(updated as Record<string, unknown>));
});

export default router;
