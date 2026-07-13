import { useState } from "react";
import { useGetDashboardStats, getGetDashboardStatsQueryKey, useListLowStockProducts, getListLowStockProductsQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import {
  Package, AlertTriangle, AlertOctagon, DollarSign, TrendingUp, Receipt,
  ArrowUp, ArrowDown, Ban, PiggyBank, History, PackagePlus, ShoppingCart, Undo2, SlidersHorizontal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  pix: "PIX",
};

const MOVEMENT_LABELS: Record<string, { label: string; icon: typeof PackagePlus }> = {
  entry: { label: "Entrada", icon: PackagePlus },
  exit: { label: "Saída", icon: SlidersHorizontal },
  adjustment: { label: "Ajuste", icon: SlidersHorizontal },
  sale: { label: "Venda", icon: ShoppingCart },
  cancellation: { label: "Estorno", icon: Undo2 },
};

function Variation({ value, suffix }: { value: number; suffix: string }) {
  const isPositive = value >= 0;
  const Icon = isPositive ? ArrowUp : ArrowDown;
  return (
    <p className={`text-xs mt-1 flex items-center gap-0.5 ${isPositive ? "text-green-600" : "text-destructive"}`}>
      <Icon className="w-3 h-3" />
      {isPositive ? "+" : ""}{value.toFixed(1)}% {suffix}
    </p>
  );
}

export default function Dashboard() {
  const [chartDays, setChartDays] = useState<7 | 30>(7);

  const { data: stats, isLoading: loadingStats } = useGetDashboardStats(
    { days: chartDays },
    { query: { queryKey: getGetDashboardStatsQueryKey({ days: chartDays }) } },
  );
  const { data: lowStockProducts, isLoading: loadingLowStock } = useListLowStockProducts({ query: { queryKey: getListLowStockProductsQueryKey() } });

  if (loadingStats) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-serif font-bold text-foreground">Início</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const paymentTotal = stats.paymentBreakdown.reduce((sum, p) => sum + p.total, 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-serif font-bold text-foreground">Visão Geral</h1>
        <p className="text-muted-foreground">O status atual da sua adega hoje.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento Hoje</CardTitle>
            <DollarSign className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.todayRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.todaySalesCount} vendas realizadas</p>
            <Variation value={stats.todayRevenueVsYesterday} suffix="vs ontem" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Médio (Hoje)</CardTitle>
            <Receipt className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.todayAverageTicket)}</div>
            <p className="text-xs text-muted-foreground mt-1">por venda em média</p>
            <Variation value={stats.todayAverageTicketVsYesterday} suffix="vs ontem" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Estoque Baixo</CardTitle>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.lowStockCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Produtos precisando de atenção</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-destructive shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Estoque Crítico</CardTitle>
            <AlertOctagon className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.criticalStockCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Produtos esgotados ou quase</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="w-4 h-4" />
              Total de SKUs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSkus}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Valor Total em Estoque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalStockValue)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Ban className="w-4 h-4 text-destructive" />
              Vendas Canceladas Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayCancelledCount}</div>
            <p className="text-xs text-muted-foreground mt-1">{formatCurrency(stats.todayCancelledValue)} estornados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <PiggyBank className="w-4 h-4 text-green-600" />
              Lucro Estimado Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.todayEstimatedProfit)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Vendas no Período</CardTitle>
              <CardDescription>Faturamento por dia</CardDescription>
            </div>
            <div className="flex gap-1">
              <Button variant={chartDays === 7 ? "default" : "outline"} size="sm" onClick={() => setChartDays(7)}>7 dias</Button>
              <Button variant={chartDays === 30 ? "default" : "outline"} size="sm" onClick={() => setChartDays(30)}>30 dias</Button>
            </div>
          </CardHeader>
          <CardContent className="pl-0 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              {chartDays === 7 ? (
                <BarChart data={stats.salesByDay}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => `R$${v}`} fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip cursor={{ fill: 'var(--muted)' }} formatter={(val: number) => formatCurrency(val)} labelFormatter={(val) => new Date(val).toLocaleDateString('pt-BR')} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={stats.salesByDay}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => `R$${v}`} fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip formatter={(val: number) => formatCurrency(val)} labelFormatter={(val) => new Date(val).toLocaleDateString('pt-BR')} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Forma de Pagamento</CardTitle>
            <CardDescription>Últimos {chartDays} dias</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.paymentBreakdown.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">Nenhuma venda no período.</p>
            ) : (
              stats.paymentBreakdown.map((p) => {
                const pct = paymentTotal > 0 ? (p.total / paymentTotal) * 100 : 0;
                return (
                  <div key={p.method} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{PAYMENT_LABELS[p.method] ?? p.method}</span>
                      <span className="text-muted-foreground">{formatCurrency(p.total)} · {pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Produtos para Repor</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingLowStock ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : lowStockProducts && lowStockProducts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Estoque Atual</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockProducts.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className={p.stockStatus === 'critical' ? 'text-destructive font-bold' : 'text-orange-600 font-bold'}>
                        {p.stockQuantity} {p.unit}
                      </TableCell>
                      <TableCell>
                        {p.stockStatus === 'critical' ? (
                          <span className="flex items-center text-xs text-destructive font-medium"><AlertOctagon className="w-3 h-3 mr-1" /> Crítico</span>
                        ) : (
                          <span className="flex items-center text-xs text-orange-600 font-medium"><AlertTriangle className="w-3 h-3 mr-1" /> Baixo</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm py-4 text-center">Nenhum produto com estoque baixo ou crítico no momento.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Movimentações Recentes de Estoque
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentStockMovements.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">Nenhuma movimentação registrada ainda.</p>
            ) : (
              <div className="space-y-3">
                {stats.recentStockMovements.map((m) => {
                  const info = MOVEMENT_LABELS[m.type] ?? { label: m.type, icon: SlidersHorizontal };
                  const Icon = info.icon;
                  return (
                    <div key={m.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="bg-primary/10 text-primary w-7 h-7 rounded-full flex items-center justify-center shrink-0">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="overflow-hidden">
                          <div className="font-medium truncate">{m.productName}</div>
                          <div className="text-xs text-muted-foreground">
                            {info.label} · {new Date(m.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                      <span className={`font-bold shrink-0 ml-2 ${m.quantity >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {m.quantity >= 0 ? '+' : ''}{m.quantity}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
