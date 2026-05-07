import { useGetDashboardStats, getGetDashboardStatsQueryKey, useListLowStockProducts, getListLowStockProductsQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { Package, AlertTriangle, AlertOctagon, DollarSign, TrendingUp, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Dashboard() {
  const { data: stats, isLoading: loadingStats } = useGetDashboardStats({ query: { queryKey: getGetDashboardStatsQueryKey() } });
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </div>

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
                  <TableHead>Mínimo Ideal</TableHead>
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
                    <TableCell>{p.minStock} {p.unit}</TableCell>
                    <TableCell>
                      {p.stockStatus === 'critical' ? (
                        <span className="flex items-center text-xs text-destructive font-medium"><AlertOctagon className="w-3 h-3 mr-1"/> Crítico</span>
                      ) : (
                        <span className="flex items-center text-xs text-orange-600 font-medium"><AlertTriangle className="w-3 h-3 mr-1"/> Baixo</span>
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
    </div>
  );
}