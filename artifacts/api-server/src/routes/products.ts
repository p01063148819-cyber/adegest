import { Router, type IRouter } from "express";
import { eq, and, ilike, lte, inArray } from "drizzle-orm";
import {
  db,
  productsTable,
  categoriesTable,
  suppliersTable,
  productComponentsTable,
  comboOptionGroupsTable,
  comboOptionsTable,
  comboOptionComponentsTable,
} from "@workspace/db";
import {
  CreateProductBody,
  UpdateProductBody,
  GetProductParams,
  UpdateProductParams,
  DeleteProductParams,
  ListProductsQueryParams,
} from "@workspace/api-zod";
import { buildComboAvailabilityContext, type ComboAvailability } from "../lib/comboStock";

const router: IRouter = Router();

type CreateProductInput = ReturnType<typeof CreateProductBody.parse>;
type UpdateProductInput = ReturnType<typeof UpdateProductBody.parse>;
type ComboComponentInput = { productId: number; quantity: number };
type ComboOptionGroupInput = { name: string; required: boolean; options: { name: string; components: ComboComponentInput[] }[] };
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function computeStockStatus(stockQuantity: number, minStock: number): string {
  if (stockQuantity === 0 || stockQuantity <= minStock * 0.5) return "critical";
  if (stockQuantity <= minStock) return "low";
  return "normal";
}

function formatProduct(
  p: Record<string, unknown>,
  categoryName: string | null,
  supplierName: string | null,
  combo?: ComboAvailability,
) {
  const rawStockQuantity = Number(p.stockQuantity ?? p.stock_quantity);
  const minStock = Number(p.minStock ?? p.min_stock);
  const stockQuantity = combo ? combo.availability : rawStockQuantity;
  return {
    ...p,
    costPrice: Number(p.costPrice ?? p.cost_price),
    salePrice: Number(p.salePrice ?? p.sale_price),
    stockQuantity,
    minStock,
    categoryName: categoryName ?? null,
    supplierName: supplierName ?? null,
    stockStatus: computeStockStatus(stockQuantity, minStock),
    isCombo: Boolean(p.isCombo),
    ...(combo ? { fixedComponents: combo.tree.fixedComponents, optionGroups: combo.tree.optionGroups } : {}),
  };
}

const productColumns = {
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
  isCombo: productsTable.isCombo,
  createdAt: productsTable.createdAt,
  updatedAt: productsTable.updatedAt,
};

async function fetchFormattedProduct(id: number) {
  const [row] = await db
    .select(productColumns)
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
    .where(eq(productsTable.id, id));

  if (!row) return null;

  const comboContext = await buildComboAvailabilityContext([row]);
  return formatProduct(row as Record<string, unknown>, row.categoryName ?? null, row.supplierName ?? null, comboContext.get(row.id));
}

function flattenComponentIds(fixedComponents: ComboComponentInput[], optionGroups: ComboOptionGroupInput[]): number[] {
  return [
    ...fixedComponents.map((c) => c.productId),
    ...optionGroups.flatMap((g) => g.options.flatMap((o) => o.components.map((c) => c.productId))),
  ];
}

function validateComboStructure(fixedComponents: ComboComponentInput[], optionGroups: ComboOptionGroupInput[]): string | null {
  for (const group of optionGroups) {
    if (group.options.length === 0) return `Grupo "${group.name}" precisa ter pelo menos uma opção`;
    for (const option of group.options) {
      if (option.components.length === 0) return `Opção "${option.name}" do grupo "${group.name}" precisa ter pelo menos um componente`;
    }
  }

  const hasRequiredGroupWithOptions = optionGroups.some((g) => g.required && g.options.length > 0);
  if (fixedComponents.length === 0 && !hasRequiredGroupWithOptions) {
    return "Um combo precisa ter pelo menos um componente fixo ou um grupo obrigatório com opções";
  }

  const allComponents = [...fixedComponents, ...optionGroups.flatMap((g) => g.options.flatMap((o) => o.components))];
  if (allComponents.some((c) => c.quantity < 1)) {
    return "A quantidade de um componente deve ser maior que zero";
  }

  return null;
}

async function validateComponentProductIds(ids: number[], excludeComboId?: number): Promise<string | null> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return null;

  if (excludeComboId !== undefined && uniqueIds.includes(excludeComboId)) {
    return "Um combo não pode ter a si mesmo como componente";
  }

  const rows = await db.select({ id: productsTable.id, isCombo: productsTable.isCombo }).from(productsTable).where(inArray(productsTable.id, uniqueIds));
  const found = new Map(rows.map((r) => [r.id, r]));

  for (const id of uniqueIds) {
    const row = found.get(id);
    if (!row) return `Produto componente ${id} não encontrado`;
    if (row.isCombo) return `Produto componente "${id}" é um combo — combos não podem ser componentes de outro combo`;
  }

  return null;
}

async function writeComboTree(
  tx: Tx,
  comboId: number,
  fixedComponents: ComboComponentInput[],
  optionGroups: ComboOptionGroupInput[],
): Promise<void> {
  await tx.delete(productComponentsTable).where(eq(productComponentsTable.comboId, comboId));
  await tx.delete(comboOptionGroupsTable).where(eq(comboOptionGroupsTable.comboId, comboId));

  if (fixedComponents.length > 0) {
    await tx.insert(productComponentsTable).values(
      fixedComponents.map((c) => ({ comboId, componentProductId: c.productId, quantity: c.quantity })),
    );
  }

  for (const group of optionGroups) {
    const [insertedGroup] = await tx
      .insert(comboOptionGroupsTable)
      .values({ comboId, name: group.name, required: group.required })
      .returning();

    for (const option of group.options) {
      const [insertedOption] = await tx
        .insert(comboOptionsTable)
        .values({ groupId: insertedGroup.id, name: option.name })
        .returning();

      if (option.components.length > 0) {
        await tx.insert(comboOptionComponentsTable).values(
          option.components.map((c) => ({ optionId: insertedOption.id, productId: c.productId, quantity: c.quantity })),
        );
      }
    }
  }
}

async function clearComboTree(tx: Tx, comboId: number): Promise<void> {
  await tx.delete(productComponentsTable).where(eq(productComponentsTable.comboId, comboId));
  await tx.delete(comboOptionGroupsTable).where(eq(comboOptionGroupsTable.comboId, comboId));
}

function toInsertRow(data: CreateProductInput, isCombo: boolean) {
  return {
    name: data.name,
    sku: data.sku ?? null,
    categoryId: data.categoryId ?? null,
    supplierId: data.supplierId ?? null,
    costPrice: data.costPrice.toString(),
    salePrice: data.salePrice.toString(),
    stockQuantity: isCombo ? 0 : data.stockQuantity,
    minStock: data.minStock,
    unit: data.unit,
    imageUrl: data.imageUrl ?? null,
    isCombo,
  };
}

function toUpdateRow(data: UpdateProductInput, isCombo: boolean) {
  const row: Partial<{
    name: string;
    sku: string | null;
    categoryId: number | null;
    supplierId: number | null;
    costPrice: string;
    salePrice: string;
    stockQuantity: number;
    minStock: number;
    unit: string;
    imageUrl: string | null;
    isCombo: boolean;
    updatedAt: Date;
  }> = { updatedAt: new Date() };

  if (data.name !== undefined) row.name = data.name;
  if (data.sku !== undefined) row.sku = data.sku ?? null;
  if (data.categoryId !== undefined) row.categoryId = data.categoryId ?? null;
  if (data.supplierId !== undefined) row.supplierId = data.supplierId ?? null;
  if (data.costPrice !== undefined) row.costPrice = data.costPrice.toString();
  if (data.salePrice !== undefined) row.salePrice = data.salePrice.toString();
  if (data.minStock !== undefined) row.minStock = data.minStock;
  if (data.unit !== undefined) row.unit = data.unit;
  if (data.imageUrl !== undefined) row.imageUrl = data.imageUrl ?? null;
  if (data.isCombo !== undefined) row.isCombo = data.isCombo;

  row.stockQuantity = isCombo ? 0 : data.stockQuantity;
  if (row.stockQuantity === undefined) delete row.stockQuantity;

  return row;
}

router.get("/products/low-stock", async (_req, res): Promise<void> => {
  const simpleProducts = await db
    .select(productColumns)
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
    .where(and(eq(productsTable.isCombo, false), lte(productsTable.stockQuantity, productsTable.minStock)))
    .orderBy(productsTable.stockQuantity);

  const comboProducts = await db
    .select(productColumns)
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
    .where(eq(productsTable.isCombo, true));

  // Combos never carry their own stockQuantity in the DB (always 0), so the SQL
  // filter above can't detect them — availability is computed and filtered here instead.
  const comboContext = await buildComboAvailabilityContext(comboProducts);

  const formattedSimple = simpleProducts.map((p) => formatProduct(p as Record<string, unknown>, p.categoryName ?? null, p.supplierName ?? null));
  const formattedCombos = comboProducts
    .map((p) => formatProduct(p as Record<string, unknown>, p.categoryName ?? null, p.supplierName ?? null, comboContext.get(p.id)))
    .filter((p) => p.stockQuantity <= p.minStock);

  const result = [...formattedSimple, ...formattedCombos].sort((a, b) => a.stockQuantity - b.stockQuantity);
  res.json(result);
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
    .select(productColumns)
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(productsTable.name);

  const comboContext = await buildComboAvailabilityContext(products);

  let result = products.map((p) =>
    formatProduct(p as Record<string, unknown>, p.categoryName ?? null, p.supplierName ?? null, comboContext.get(p.id)),
  );

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

  const isCombo = parsed.data.isCombo ?? false;
  const fixedComponents = parsed.data.fixedComponents ?? [];
  const optionGroups = parsed.data.optionGroups ?? [];

  if (isCombo) {
    const structureError = validateComboStructure(fixedComponents, optionGroups);
    if (structureError) {
      res.status(400).json({ error: structureError });
      return;
    }
    const componentError = await validateComponentProductIds(flattenComponentIds(fixedComponents, optionGroups));
    if (componentError) {
      res.status(400).json({ error: componentError });
      return;
    }
  }

  const product = await db.transaction(async (tx) => {
    const [inserted] = await tx.insert(productsTable).values(toInsertRow(parsed.data, isCombo)).returning();
    if (isCombo) {
      await writeComboTree(tx, inserted.id, fixedComponents, optionGroups);
    }
    return inserted;
  });

  const formatted = await fetchFormattedProduct(product.id);
  res.status(201).json(formatted);
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const formatted = await fetchFormattedProduct(params.data.id);
  if (!formatted) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(formatted);
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

  const [existing] = await db.select({ id: productsTable.id, isCombo: productsTable.isCombo }).from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const isCombo = parsed.data.isCombo ?? existing.isCombo;
  const structureProvided = parsed.data.fixedComponents !== undefined || parsed.data.optionGroups !== undefined || parsed.data.isCombo !== undefined;
  const fixedComponents = parsed.data.fixedComponents ?? [];
  const optionGroups = parsed.data.optionGroups ?? [];

  if (structureProvided && isCombo) {
    const structureError = validateComboStructure(fixedComponents, optionGroups);
    if (structureError) {
      res.status(400).json({ error: structureError });
      return;
    }
    const componentError = await validateComponentProductIds(flattenComponentIds(fixedComponents, optionGroups), params.data.id);
    if (componentError) {
      res.status(400).json({ error: componentError });
      return;
    }
  }

  const updateRow = toUpdateRow(parsed.data, isCombo);

  const updated = await db.transaction(async (tx) => {
    const [product] = await tx.update(productsTable).set(updateRow).where(eq(productsTable.id, params.data.id)).returning();
    if (structureProvided) {
      if (isCombo) {
        await writeComboTree(tx, params.data.id, fixedComponents, optionGroups);
      } else {
        await clearComboTree(tx, params.data.id);
      }
    }
    return product;
  });

  if (!updated) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const formatted = await fetchFormattedProduct(params.data.id);
  res.json(formatted);
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [usedAsFixedComponent] = await db
    .select({ id: productComponentsTable.id })
    .from(productComponentsTable)
    .where(eq(productComponentsTable.componentProductId, params.data.id))
    .limit(1);
  const [usedAsOptionComponent] = await db
    .select({ id: comboOptionComponentsTable.id })
    .from(comboOptionComponentsTable)
    .where(eq(comboOptionComponentsTable.productId, params.data.id))
    .limit(1);

  if (usedAsFixedComponent || usedAsOptionComponent) {
    res.status(400).json({ error: "Este produto é usado como componente de um combo e não pode ser excluído" });
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
