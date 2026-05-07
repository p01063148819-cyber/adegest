import { useState } from "react";
import { Link } from "wouter";
import { useListSales, getListSalesQueryKey, useCancelSale } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Ban, FileText, CalendarDays, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

function toLocalISODate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayStart(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function dayEnd(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

type StatusFilter = "all" | "confirmed" | "cancelled";

const SHORTCUTS = [
  { label: "Hoje", getRange: () => { const t = new Date(); return { from: toLocalISODate(t), to: toLocalISODate(t) }; } },
  { label: "Ontem", getRange: () => { const t = new Date(); t.setDate(t.getDate() - 1); return { from: toLocalISODate(t), to: toLocalISODate(t) }; } },
  { label: "Esta semana", getRange: () => { const t = new Date(); const day = t.getDay(); const mon = new Date(t); mon.setDate(t.getDate() - (day === 0 ? 6 : day - 1)); return { from: toLocalISODate(mon), to: toLocalISODate(t) }; } },
  { label: "Este mês", getRange: () => { const t = new Date(); const first = new Date(t.getFullYear(), t.getMonth(), 1); return { from: toLocalISODate(first), to: toLocalISODate(t) }; } },
];

export default function Vendas() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [activeShortcut, setActiveShortcut] = useState<string | null>(null);

  const params = {
    ...(fromDate ? { startDate: dayStart(new Date(fromDate + "T00:00:00")) } : {}),
    ...(toDate ? { endDate: dayEnd(new Date(toDate + "T00:00:00")) } : {}),
    ...(status !== "all" ? { status: status as "confirmed" | "cancelled" } : {}),
  };

  const { data: sales, isLoading } = useListSales(params, {
    query: { queryKey: getListSalesQueryKey(params) },
  });

  const cancelSale = useCancelSale();

  const handleCancel = (id: number) => {
    if (confirm("Atenção: Cancelar esta venda irá estornar os produtos para o estoque. Confirma o cancelamento?")) {
      cancelSale.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSalesQueryKey(params) });
          toast({ title: "Venda cancelada com sucesso." });
        },
      });
    }
  };

  const applyShortcut = (shortcut: typeof SHORTCUTS[0]) => {
    const { from, to } = shortcut.getRange();
    setFromDate(from);
    setToDate(to);
    setActiveShortcut(shortcut.label);
  };

  const clearFilters = () => {
    setFromDate("");
    setToDate("");
    setStatus("all");
    setActiveShortcut(null);
  };

  const hasFilters = fromDate || toDate || status !== "all";

  const getStatusBadge = (s: string) => {
    if (s === "cancelled") return <Badge variant="destructive">Cancelada</Badge>;
    return <Badge variant="outline" className="bg-green-50 text-green-600 border-green-600">Confirmada</Badge>;
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case "dinheiro": return "Dinheiro";
      case "cartao": return "Cartão";
      case "pix": return "PIX";
      default: return method;
    }
  };

  const totalFiltered = sales?.reduce((sum, s) => s.status === "confirmed" ? sum + s.total : sum, 0) ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Histórico de Vendas</h1>
          <p className="text-muted-foreground">Consulte e filtre as vendas realizadas.</p>
        </div>
        <Link href="/vendas/nova">
          <Button size="lg" className="shadow-md">
            <Plus className="w-5 h-5 mr-2" />
            Nova Venda (PDV)
          </Button>
        </Link>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CalendarDays className="w-4 h-4" />
          Filtros
        </div>

        <div className="flex flex-wrap gap-2">
          {SHORTCUTS.map((s) => (
            <Button
              key={s.label}
              variant={activeShortcut === s.label ? "default" : "outline"}
              size="sm"
              onClick={() => applyShortcut(s)}
            >
              {s.label}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label htmlFor="from-date" className="text-xs text-muted-foreground">Data inicial</Label>
            <Input
              id="from-date"
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => { setFromDate(e.target.value); setActiveShortcut(null); }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to-date" className="text-xs text-muted-foreground">Data final</Label>
            <Input
              id="to-date"
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => { setToDate(e.target.value); setActiveShortcut(null); }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="confirmed">Confirmadas</SelectItem>
                <SelectItem value="cancelled">Canceladas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {hasFilters && (
          <div className="flex items-center justify-between pt-1">
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Carregando…" : (
                <>
                  <span className="font-medium text-foreground">{sales?.length ?? 0}</span> venda{sales?.length !== 1 ? "s" : ""} encontrada{sales?.length !== 1 ? "s" : ""}
                  {totalFiltered > 0 && (
                    <> · Total confirmado: <span className="font-medium text-foreground">{formatCurrency(totalFiltered)}</span></>
                  )}
                </>
              )}
            </p>
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3 mr-1" />
              Limpar filtros
            </Button>
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Venda</TableHead>
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
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FileText className="h-10 w-10 opacity-20" />
                    {hasFilters ? "Nenhuma venda encontrada para os filtros selecionados." : "Nenhuma venda registrada."}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sales?.map((sale) => (
                <TableRow key={sale.id} className={sale.status === "cancelled" ? "opacity-60" : ""}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(sale.createdAt)}
                    <div className="text-xs text-muted-foreground">
                      {new Date(sale.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      Venda #{sale.id}
                      {sale.discount > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">(-{formatCurrency(sale.discount)})</span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {getPaymentMethodLabel(sale.paymentMethod)}
                    </Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(sale.status)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(sale.total)}
                  </TableCell>
                  <TableCell className="text-right">
                    {sale.status === "confirmed" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCancel(sale.id)}
                        title="Cancelar Venda"
                      >
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
