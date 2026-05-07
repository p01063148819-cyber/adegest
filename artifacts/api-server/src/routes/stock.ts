import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, stockMovementsTable, productsTable } from "@workspace/db";
import {
  CreateStockMovementBody,
  ListStockMovementsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stock/movements", async (req, res): Promise<void> => {
  const query = ListStockMovementsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { productId } = query.data;

  const movements = await db
    .select({
      id: stockMovementsTable.id,
      productId: stockMovementsTable.productId,
      productName: productsTable.name,
      type: stockMovementsTable.type,
      quantity: stockMovementsTable.quantity,
      invoiceNumber: stockMovementsTable.invoiceNumber,
      notes: stockMovementsTable.notes,
      createdAt: stockMovementsTable.createdAt,
    })
    .from(stockMovementsTable)
    .leftJoin(productsTable, eq(stockMovementsTable.productId, productsTable.id))
    .where(productId ? eq(stockMovementsTable.productId, productId) : undefined)
    .orderBy(sql`${stockMovementsTable.createdAt} DESC`);

  res.json(movements.map((m) => ({ ...m, productName: m.productName ?? "Produto removido" })));
});

router.post("/stock/movements", async (req, res): Promise<void> => {
  const parsed = CreateStockMovementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, parsed.data.productId));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const [movement] = await db.insert(stockMovementsTable).values(parsed.data).returning();

  // Update product stock based on movement type
  const delta = parsed.data.type === "entry" ? parsed.data.quantity : parsed.data.quantity;
  await db
    .update(productsTable)
    .set({ stockQuantity: sql`${productsTable.stockQuantity} + ${delta}`, updatedAt: new Date() })
    .where(eq(productsTable.id, parsed.data.productId));

  res.status(201).json({ ...movement, productName: product.name });
});

export default router;
