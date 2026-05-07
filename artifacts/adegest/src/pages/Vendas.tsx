import { useState } from "react";
import { Link } from "wouter";
import { useListSales, getListSalesQueryKey, useCancelSale } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, ShoppingCart, Ban, Search, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export default function Vendas() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: sales, isLoading } = useListSales({ }, { query: { queryKey: getListSalesQueryKey({}) } });
  const cancelSale = useCancelSale();

  const handleCancel = (id: number) => {
    if (confirm("Atenção: Cancelar esta venda irá estornar os produtos para o estoque. Confirma o cancelamento?")) {
      cancelSale.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSalesQueryKey({}) });
          toast({ title: "Venda cancelada com sucesso." });
        }
      });
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "cancelled") return <Badge variant="destructive">Cancelada</Badge>;
    return <Badge variant="outline" className="bg-green-50 text-green-600 border-green-600">Confirmada</Badge>;
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'dinheiro': return 'Dinheiro';
      case 'cartao': return 'Cartão';
      case 'pix': return 'PIX';
      default: return method;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Histórico de Vendas</h1>
          <p className="text-muted-foreground">Consulte as vendas realizadas.</p>
        </div>
        <Link href="/vendas/nova">
          <Button size="lg" className="shadow-md">
            <Plus className="w-5 h-5 mr-2" />
            Nova Venda (PDV)
          </Button>
        </Link>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Resumo dos Itens</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [1, 2, 3, 4].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-6 w-16 ml-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-10 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : sales?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center">
                    <FileText className="h-10 w-10 mb-2 opacity-20" />
                    Nenhuma venda registrada.
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sales?.map((sale) => (
                <TableRow key={sale.id} className={sale.status === 'cancelled' ? 'opacity-60' : ''}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(sale.createdAt)}
                    <div className="text-xs text-muted-foreground">
                      {new Date(sale.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[300px] truncate text-sm" title={sale.notes || "Itens da venda"}>
                      Venda #{sale.id} {sale.discount > 0 ? `(-${formatCurrency(sale.discount)})` : ''}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {getPaymentMethodLabel(sale.paymentMethod)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(sale.status)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(sale.total)}
                  </TableCell>
                  <TableCell className="text-right">
                    {sale.status === 'confirmed' && (
                      <Button variant="ghost" size="icon" onClick={() => handleCancel(sale.id)} title="Cancelar Venda">
                        <Ban className="w-4 h-4 text-destructive/70 hover:text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}