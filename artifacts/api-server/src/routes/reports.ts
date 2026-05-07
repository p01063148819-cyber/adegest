import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql, ne } from "drizzle-orm";
import { db, salesTable, saleItemsTable, productsTable, categoriesTable } from "@workspace/db";
import { GetDailyReportQueryParams, GetWeeklyReportQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}
function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  r.setDate(r.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

async function getSalesInRange(start: Date, end: Date) {
  return db
    .select()
    .from(salesTable)
    .where(
      and(
        eq(salesTable.status, "confirmed"),
        gte(salesTable.createdAt, start),
        lte(salesTable.createdAt, end),
      ),
    );
}

async function getTopProducts(start: Date, end: Date, limit = 10) {
  const rows = await db
    .select({
      productId: saleItemsTable.productId,
      productName: productsTable.name,
      quantitySold: sql<number>`cast(sum(${saleItemsTable.quantity}) as int)`,
      revenue: sql<number>`sum(${saleItemsTable.subtotal})`,
    })
    .from(saleItemsTable)
    .innerJoin(salesTable, and(eq(saleItemsTable.saleId, salesTable.id), eq(salesTable.status, "confirmed")))
    .leftJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
    .where(and(gte(salesTable.createdAt, start), lte(salesTable.createdAt, end)))
    .groupBy(saleItemsTable.productId, productsTable.name)
    .orderBy(sql`sum(${saleItemsTable.subtotal}) DESC`)
    .limit(limit);

  return rows.map((r) => ({
    productId: r.productId,
    productName: r.productName ?? "Produto removido",
    quantitySold: Number(r.quantitySold),
    revenue: Number(r.revenue),
  }));
}

async function getCategorySales(start: Date, end: Date) {
  const rows = await db
    .select({
      categoryName: categoriesTable.name,
      revenue: sql<number>`sum(${saleItemsTable.subtotal})`,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(saleItemsTable)
    .innerJoin(salesTable, and(eq(saleItemsTable.saleId, salesTable.id), eq(salesTable.status, "confirmed")))
    .leftJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(and(gte(salesTable.createdAt, start), lte(salesTable.createdAt, end)))
    .groupBy(categoriesTable.name)
    .orderBy(sql`sum(${saleItemsTable.subtotal}) DESC`);

  return rows.map((r) => ({
    categoryName: r.categoryName ?? "Sem categoria",
    revenue: Number(r.revenue),
    count: Number(r.count),
  }));
}

router.get("/reports/dashboard", async (_req, res): Promise<void> => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfWeek(now);

  const [totalSkusRow] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(productsTable);
  const [lowStockRow] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(productsTable)
    .where(and(lte(productsTable.stockQuantity, productsTable.minStock), sql`${productsTable.stockQuantity} > 0`));
  const [criticalRow] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(productsTable)
    .where(
      sql`${productsTable.stockQuantity} = 0 OR ${productsTable.stockQuantity} <= ${productsTable.minStock} * 0.5`,
    );

  const [stockValueRow] = await db
    .select({ value: sql<number>`sum(cast(${productsTable.salePrice} as numeric) * ${productsTable.stockQuantity})` })
    .from(productsTable);

  const todaySales = await getSalesInRange(todayStart, todayEnd);
  const todayRevenue = todaySales.reduce((acc, s) => acc + Number(s.total), 0);
  const todaySalesCount = todaySales.length;
  const todayAverageTicket = todaySalesCount > 0 ? todayRevenue / todaySalesCount : 0;

  const weekSales = await getSalesInRange(weekStart, todayEnd);
  const weekRevenue = weekSales.reduce((acc, s) => acc + Number(s.total), 0);

  res.json({
    totalSkus: Number(totalSkusRow?.count ?? 0),
    lowStockCount: Number(lowStockRow?.count ?? 0),
    criticalStockCount: Number(criticalRow?.count ?? 0),
    totalStockValue: Number(stockValueRow?.value ?? 0),
    todayRevenue,
    todaySalesCount,
    todayAverageTicket,
    weekRevenue,
  });
});

router.get("/reports/daily", async (req, res): Promise<void> => {
  const query = GetDailyReportQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const targetDate = query.data.date ? new Date(query.data.date as string) : new Date();
  const todayStart = startOfDay(targetDate);
  const todayEnd = endOfDay(targetDate);
  const yesterdayStart = startOfDay(addDays(targetDate, -1));
  const yesterdayEnd = endOfDay(addDays(targetDate, -1));

  const todaySales = await getSalesInRange(todayStart, todayEnd);
  const yesterdaySales = await getSalesInRange(yesterdayStart, yesterdayEnd);

  const totalRevenue = todaySales.reduce((acc, s) => acc + Number(s.total), 0);
  const salesCount = todaySales.length;
  const averageTicket = salesCount > 0 ? totalRevenue / salesCount : 0;

  const yRevenue = yesterdaySales.reduce((acc, s) => acc + Number(s.total), 0);
  const yCount = yesterdaySales.length;
  const revenueVsYesterday = yRevenue > 0 ? ((totalRevenue - yRevenue) / yRevenue) * 100 : 0;
  const countVsYesterday = yCount > 0 ? ((salesCount - yCount) / yCount) * 100 : 0;

  // Hourly sales
  const hourlySalesRows = await db
    .select({
      hour: sql<number>`extract(hour from ${salesTable.createdAt})::int`,
      revenue: sql<number>`sum(cast(${salesTable.total} as numeric))`,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(salesTable)
    .where(and(eq(salesTable.status, "confirmed"), gte(salesTable.createdAt, todayStart), lte(salesTable.createdAt, todayEnd)))
    .groupBy(sql`extract(hour from ${salesTable.createdAt})`)
    .orderBy(sql`extract(hour from ${salesTable.createdAt})`);

  const hourlySales = hourlySalesRows.map((r) => ({
    hour: Number(r.hour),
    revenue: Number(r.revenue),
    count: Number(r.count),
  }));

  const topProducts = await getTopProducts(todayStart, todayEnd, 5);
  const categorySales = await getCategorySales(todayStart, todayEnd);

  res.json({
    date: targetDate.toISOString().split("T")[0],
    totalRevenue,
    salesCount,
    averageTicket,
    revenueVsYesterday,
    countVsYesterday,
    topProducts,
    hourlySales,
    categorySales,
  });
});

router.get("/reports/weekly", async (req, res): Promise<void> => {
  const query = GetWeeklyReportQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const now = new Date();
  const weekStart = query.data.startDate ? startOfDay(new Date(query.data.startDate as string)) : startOfWeek(now);
  const weekEnd = endOfDay(addDays(weekStart, 6));
  const prevWeekStart = startOfDay(addDays(weekStart, -7));
  const prevWeekEnd = endOfDay(addDays(prevWeekStart, 6));

  const sales = await getSalesInRange(weekStart, weekEnd);
  const prevSales = await getSalesInRange(prevWeekStart, prevWeekEnd);

  const totalRevenue = sales.reduce((acc, s) => acc + Number(s.total), 0);
  const salesCount = sales.length;
  const averageTicket = salesCount > 0 ? totalRevenue / salesCount : 0;

  const prevRevenue = prevSales.reduce((acc, s) => acc + Number(s.total), 0);
  const prevCount = prevSales.length;
  const prevTicket = prevCount > 0 ? prevRevenue / prevCount : 0;

  const revenueVsPrevWeek = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
  const countVsPrevWeek = prevCount > 0 ? ((salesCount - prevCount) / prevCount) * 100 : 0;
  const ticketVsPrevWeek = prevTicket > 0 ? ((averageTicket - prevTicket) / prevTicket) * 100 : 0;

  // Calculate gross margin
  const saleItemsThisWeek = await db
    .select({
      productId: saleItemsTable.productId,
      quantity: saleItemsTable.quantity,
      subtotal: saleItemsTable.subtotal,
      costPrice: productsTable.costPrice,
    })
    .from(saleItemsTable)
    .innerJoin(salesTable, and(eq(saleItemsTable.saleId, salesTable.id), eq(salesTable.status, "confirmed")))
    .leftJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
    .where(and(gte(salesTable.createdAt, weekStart), lte(salesTable.createdAt, weekEnd)));

  const totalCost = saleItemsThisWeek.reduce(
    (acc, item) => acc + Number(item.costPrice ?? 0) * Number(item.quantity),
    0,
  );
  const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;

  // Daily sales
  const dailySalesRows = await db
    .select({
      date: sql<string>`to_char(${salesTable.createdAt}, 'YYYY-MM-DD')`,
      revenue: sql<number>`sum(cast(${salesTable.total} as numeric))`,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(salesTable)
    .where(and(eq(salesTable.status, "confirmed"), gte(salesTable.createdAt, weekStart), lte(salesTable.createdAt, weekEnd)))
    .groupBy(sql`to_char(${salesTable.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${salesTable.createdAt}, 'YYYY-MM-DD')`);

  const dailySales = dailySalesRows.map((r) => ({
    date: r.date,
    revenue: Number(r.revenue),
    count: Number(r.count),
  }));

  const topProducts = await getTopProducts(weekStart, weekEnd, 10);
  const categorySales = await getCategorySales(weekStart, weekEnd);

  // Products with no movement this week
  const soldProductIds = topProducts.map((p) => p.productId);
  let noMovementProducts: typeof topProducts = [];
  if (soldProductIds.length === 0) {
    const allProducts = await db.select({ id: productsTable.id, name: productsTable.name }).from(productsTable).limit(10);
    noMovementProducts = allProducts.map((p) => ({ productId: p.id, productName: p.name, quantitySold: 0, revenue: 0 }));
  } else {
    const noMovement = await db
      .select({ id: productsTable.id, name: productsTable.name })
      .from(productsTable)
      .where(sql`${productsTable.id} != ALL(ARRAY[${sql.join(soldProductIds.map((id) => sql`${id}`), sql`, `)}]::int[])`)
      .limit(10);
    noMovementProducts = noMovement.map((p) => ({ productId: p.id, productName: p.name, quantitySold: 0, revenue: 0 }));
  }

  res.json({
    startDate: weekStart.toISOString().split("T")[0],
    endDate: weekEnd.toISOString().split("T")[0],
    totalRevenue,
    salesCount,
    averageTicket,
    grossMargin,
    revenueVsPrevWeek,
    countVsPrevWeek,
    ticketVsPrevWeek,
    dailySales,
    topProducts,
    categorySales,
    noMovementProducts,
  });
});

export default router;
