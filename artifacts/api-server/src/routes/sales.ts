import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db, salesTable, saleItemsTable, productsTable } from "@workspace/db";
import {
  CreateSaleBody,
  GetSaleParams,
  CancelSaleParams,
  ListSalesQueryParams,
} from "@workspace/api-zod";

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
  const parsed = CreateSaleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { paymentMethod, discount = 0, notes, items } = parsed.data;

  // Validate stock for all items
  for (const item of items) {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
    if (!product) {
      res.status(400).json({ error: `Produto ${item.productId} não encontrado` });
      return;
    }
    if (product.stockQuantity < item.quantity) {
      res.status(400).json({
        error: `Estoque insuficiente para "${product.name}". Disponível: ${product.stockQuantity}, Solicitado: ${item.quantity}`,
      });
      return;
    }
  }

  // Calculate totals
  let subtotalSum = 0;
  const itemsWithPrices: Array<{ productId: number; quantity: number; unitPrice: number; discount: number; subtotal: number; name: string }> = [];

  for (const item of items) {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
    const unitPrice = Number(product!.salePrice);
    const itemDiscount = item.discount ?? 0;
    const subtotal = unitPrice * item.quantity - itemDiscount;
    subtotalSum += subtotal;
    itemsWithPrices.push({ productId: item.productId, quantity: item.quantity, unitPrice, discount: itemDiscount, subtotal, name: product!.name });
  }

  const total = subtotalSum - Number(discount);

  // Create sale in transaction
  const [sale] = await db.insert(salesTable).values({
    total: total.toString(),
    discount: discount.toString(),
    paymentMethod,
    status: "confirmed",
    notes: notes ?? null,
  }).returning();

  // Insert sale items and deduct stock
  for (const item of itemsWithPrices) {
    await db.insert(saleItemsTable).values({
      saleId: sale.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toString(),
      discount: item.discount.toString(),
      subtotal: item.subtotal.toString(),
    });

    await db
      .update(productsTable)
      .set({ stockQuantity: sql`${productsTable.stockQuantity} - ${item.quantity}`, updatedAt: new Date() })
      .where(eq(productsTable.id, item.productId));
  }

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
    })
    .from(saleItemsTable)
    .leftJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
    .where(eq(saleItemsTable.saleId, params.data.id));

  res.json({
    ...formatSale(sale as Record<string, unknown>),
    items: items.map((item) => ({
      ...formatSaleItem(item as Record<string, unknown>),
      productName: item.productName ?? "Produto removido",
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

  // Restore stock
  const items = await db.select().from(saleItemsTable).where(eq(saleItemsTable.saleId, params.data.id));
  for (const item of items) {
    await db
      .update(productsTable)
      .set({ stockQuantity: sql`${productsTable.stockQuantity} + ${item.quantity}`, updatedAt: new Date() })
      .where(eq(productsTable.id, item.productId));
  }

  const [updated] = await db
    .update(salesTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(salesTable.id, params.data.id))
    .returning();

  res.json(formatSale(updated as Record<string, unknown>));
});

export default router;
