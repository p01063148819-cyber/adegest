import { useState } from "react";
import { useGetDailyReport, getGetDailyReportQueryKey, useGetWeeklyReport, getGetWeeklyReportQueryKey } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { Calendar, DollarSign, TrendingUp, ShoppingBag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function Relatorios() {
  const { data: daily, isLoading: loadingDaily } = useGetDailyReport({ }, { query: { queryKey: getGetDailyReportQueryKey({}) } });
  const { data: weekly, isLoading: loadingWeekly } = useGetWeeklyReport({ }, { query: { queryKey: getGetWeeklyReportQueryKey({}) } });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground">Métricas e resultados da sua adega.</p>
      </div>

      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full sm:w-[400px] grid-cols-2">
          <TabsTrigger value="daily">Diário (Hoje)</TabsTrigger>
          <TabsTrigger value="weekly">Semanal (Últimos 7 dias)</TabsTrigger>
        </TabsList>
        
        <TabsContent value="daily" className="space-y-6 pt-4">
          {loadingDaily ? (
            <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>
          ) : daily ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Faturamento</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(daily.totalRevenue)}</div>
                    <p className={`text-xs ${daily.revenueVsYesterday >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                      {daily.revenueVsYesterday >= 0 ? '+' : ''}{daily.revenueVsYesterday.toFixed(1)}% em relação a ontem
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Vendas Realizadas</CardTitle>
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{daily.salesCount}</div>
                    <p className={`text-xs ${daily.countVsYesterday >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                      {daily.countVsYesterday >= 0 ? '+' : ''}{daily.countVsYesterday.toFixed(1)}% em relação a ontem
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(daily.averageTicket)}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="col-span-1">
                  <CardHeader>
                    <CardTitle>Vendas por Hora</CardTitle>
                    <CardDescription>Distribuição de faturamento ao longo do dia</CardDescription>
                  </CardHeader>
                  <CardContent className="pl-0 h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={daily.hourlySales}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="hour" tickFormatter={(v) => `${v}h`} fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis tickFormatter={(v) => `R$${v}`} fontSize={12} tickLine={false} axisLine={false} />
                        <RechartsTooltip cursor={{fill: 'var(--muted)'}} formatter={(val: number) => formatCurrency(val)} labelFormatter={(val) => `${val}:00`} />
                        <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                
                <Card className="col-span-1">
                  <CardHeader>
                    <CardTitle>Produtos Mais Vendidos</CardTitle>
                    <CardDescription>Top 5 produtos no dia</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {daily.topProducts.map((p, i) => (
                        <div key={p.productId} className="flex items-center justify-between">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="bg-primary/10 text-primary font-bold w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0">{i + 1}</div>
                            <span className="font-medium text-sm truncate">{p.productName}</span>
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            <div className="font-bold text-sm">{formatCurrency(p.revenue)}</div>
                            <div className="text-xs text-muted-foreground">{p.quantitySold} unid</div>
                          </div>
                        </div>
                      ))}
                      {daily.topProducts.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma venda registrada hoje.</div>}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="weekly" className="space-y-6 pt-4">
           {loadingWeekly ? (
            <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>
          ) : weekly ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Faturamento Semanal</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(weekly.totalRevenue)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Margem Bruta Est.</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(weekly.grossMargin)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{weekly.salesCount}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(weekly.averageTicket)}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="col-span-1 lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Evolução Diária</CardTitle>
                    <CardDescription>Faturamento nos últimos dias</CardDescription>
                  </CardHeader>
                  <CardContent className="pl-0 h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weekly.dailySales}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})} fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis tickFormatter={(v) => `R$${v}`} fontSize={12} tickLine={false} axisLine={false} />
                        <RechartsTooltip formatter={(val: number) => formatCurrency(val)} labelFormatter={(val) => new Date(val).toLocaleDateString('pt-BR')} />
                        <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={3} dot={{r: 4, fill: 'hsl(var(--primary))'}} activeDot={{r: 6}} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="col-span-1">
                  <CardHeader>
                    <CardTitle>Vendas por Categoria</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={weekly.categorySales}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="revenue"
                          nameKey="categoryName"
                        >
                          {weekly.categorySales.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(val: number) => formatCurrency(val)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-4 flex flex-wrap gap-2 justify-center">
                      {weekly.categorySales.map((cat, i) => (
                        <div key={cat.categoryName} className="flex items-center text-xs">
                          <div className="w-3 h-3 rounded-full mr-1" style={{backgroundColor: COLORS[i % COLORS.length]}}></div>
                          <span className="truncate max-w-[80px]">{cat.categoryName}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}