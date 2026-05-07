import { Router, type IRouter } from "express";
import { eq, and, or, ilike, lte, sql } from "drizzle-orm";
import { db, productsTable, categoriesTable, suppliersTable } from "@workspace/db";
import {
  CreateProductBody,
  UpdateProductBody,
  GetProductParams,
  UpdateProductParams,
  DeleteProductParams,
  ListProductsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function computeStockStatus(stockQuantity: number, minStock: number): string {
  if (stockQuantity === 0 || stockQuantity <= minStock * 0.5) return "critical";
  if (stockQuantity <= minStock) return "low";
  return "normal";
}

function formatProduct(p: Record<string, unknown>, categoryName: string | null, supplierName: string | null) {
  const stockQty = Number(p.stockQuantity ?? p.stock_quantity);
  const minStock = Number(p.minStock ?? p.min_stock);
  return {
    ...p,
    costPrice: Number(p.costPrice ?? p.cost_price),
    salePrice: Number(p.salePrice ?? p.sale_price),
    stockQuantity: stockQty,
    minStock,
    categoryName: categoryName ?? null,
    supplierName: supplierName ?? null,
    stockStatus: computeStockStatus(stockQty, minStock),
  };
}

router.get("/products/low-stock", async (_req, res): Promise<void> => {
  const products = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      sku: productsTable.sku,
      categoryId: productsTable.categoryId,
      categoryName: categoriesTable.name,
      supplierId: productsTable.supplierId,
      supplierName: suppliersTable.name,
      costPrice: productsTable.costPrice,
      salePrice: productsTable.salePrice,
      stockQuantity: productsTable.stockQuantity,
      minStock: productsTable.minStock,
      unit: productsTable.unit,
      imageUrl: productsTable.imageUrl,
      createdAt: productsTable.createdAt,
      updatedAt: productsTable.updatedAt,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
    .where(lte(productsTable.stockQuantity, productsTable.minStock))
    .orderBy(productsTable.stockQuantity);

  res.json(products.map((p) => formatProduct(p as Record<string, unknown>, p.categoryName ?? null, p.supplierName ?? null)));
});

router.get("/products", async (req, res): Promise<void> => {
  const query = ListProductsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { categoryId, search, stockStatus } = query.data;

  const conditions = [];
  if (categoryId) conditions.push(eq(productsTable.categoryId, categoryId));
  if (search) conditions.push(ilike(productsTable.name, `%${search}%`));

  const products = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      sku: productsTable.sku,
      categoryId: productsTable.categoryId,
      categoryName: categoriesTable.name,
      supplierId: productsTable.supplierId,
      supplierName: suppliersTable.name,
      costPrice: productsTable.costPrice,
      salePrice: productsTable.salePrice,
      stockQuantity: productsTable.stockQuantity,
      minStock: productsTable.minStock,
      unit: productsTable.unit,
      imageUrl: productsTable.imageUrl,
      createdAt: productsTable.createdAt,
      updatedAt: productsTable.updatedAt,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(productsTable.name);

  let result = products.map((p) => formatProduct(p as Record<string, unknown>, p.categoryName ?? null, p.supplierName ?? null));

  if (stockStatus) {
    result = result.filter((p) => p.stockStatus === stockStatus);
  }

  res.json(result);
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [product] = await db.insert(productsTable).values(parsed.data).returning();

  const [joined] = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      sku: productsTable.sku,
      categoryId: productsTable.categoryId,
      categoryName: categoriesTable.name,
      supplierId: productsTable.supplierId,
      supplierName: suppliersTable.name,
      costPrice: productsTable.costPrice,
      salePrice: productsTable.salePrice,
      stockQuantity: productsTable.stockQuantity,
      minStock: productsTable.minStock,
      unit: productsTable.unit,
      imageUrl: productsTable.imageUrl,
      createdAt: productsTable.createdAt,
      updatedAt: productsTable.updatedAt,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
    .where(eq(productsTable.id, product.id));

  res.status(201).json(formatProduct(joined as Record<string, unknown>, joined?.categoryName ?? null, joined?.supplierName ?? null));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      sku: productsTable.sku,
      categoryId: productsTable.categoryId,
      categoryName: categoriesTable.name,
      supplierId: productsTable.supplierId,
      supplierName: suppliersTable.name,
      costPrice: productsTable.costPrice,
      salePrice: productsTable.salePrice,
      stockQuantity: productsTable.stockQuantity,
      minStock: productsTable.minStock,
      unit: productsTable.unit,
      imageUrl: productsTable.imageUrl,
      createdAt: productsTable.createdAt,
      updatedAt: productsTable.updatedAt,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
    .where(eq(productsTable.id, params.data.id));

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(formatProduct(product as Record<string, unknown>, product.categoryName ?? null, product.supplierName ?? null));
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [product] = await db
    .update(productsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(productsTable.id, params.data.id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const [joined] = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      sku: productsTable.sku,
      categoryId: productsTable.categoryId,
      categoryName: categoriesTable.name,
      supplierId: productsTable.supplierId,
      supplierName: suppliersTable.name,
      costPrice: productsTable.costPrice,
      salePrice: productsTable.salePrice,
      stockQuantity: productsTable.stockQuantity,
      minStock: productsTable.minStock,
      unit: productsTable.unit,
      imageUrl: productsTable.imageUrl,
      createdAt: productsTable.createdAt,
      updatedAt: productsTable.updatedAt,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
    .where(eq(productsTable.id, params.data.id));

  res.json(formatProduct(joined as Record<string, unknown>, joined?.categoryName ?? null, joined?.supplierName ?? null));
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db.delete(productsTable).where(eq(productsTable.id, params.data.id)).returning();
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
