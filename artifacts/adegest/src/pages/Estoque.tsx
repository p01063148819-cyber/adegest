import { useState } from "react";
import { useListProducts, getListProductsQueryKey, useListCategories, getListCategoriesQueryKey, useCreateStockMovement } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PackagePlus, PackageMinus, Package, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function Estoque() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);

  const { data: products, isLoading } = useListProducts({ 
    categoryId: categoryId || undefined, 
    search: search || undefined 
  }, { 
    query: { queryKey: getListProductsQueryKey({ categoryId: categoryId || undefined, search: search || undefined }) } 
  });
  
  const { data: categories } = useListCategories({ query: { queryKey: getListCategoriesQueryKey() } });
  
  const createStockMovement = useCreateStockMovement();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [movementType, setMovementType] = useState<"entry" | "adjustment">("entry");
  
  const [formData, setFormData] = useState({
    quantity: 1,
    invoiceNumber: "",
    notes: ""
  });

  const handleOpenDialog = (product: any, type: "entry" | "adjustment") => {
    setSelectedProduct(product);
    setMovementType(type);
    setFormData({ quantity: 1, invoiceNumber: "", notes: "" });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!selectedProduct || formData.quantity <= 0) return;

    createStockMovement.mutate({ 
      data: {
        productId: selectedProduct.id,
        type: movementType,
        quantity: formData.quantity,
        invoiceNumber: formData.invoiceNumber || undefined,
        notes: formData.notes || undefined
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        setIsDialogOpen(false);
        toast({ title: movementType === "entry" ? "Entrada registrada." : "Ajuste de estoque registrado." });
      }
    });
  };

  const getStockBadge = (status: string, qty: number, min: number) => {
    if (status === "critical") return <Badge variant="destructive">Crítico ({qty}/{min})</Badge>;
    if (status === "low") return <Badge variant="default" className="bg-orange-500 hover:bg-orange-600">Atenção ({qty}/{min})</Badge>;
    return <Badge variant="outline" className="text-green-600 border-green-600 bg-green-50">Normal ({qty})</Badge>;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Controle de Estoque</h1>
          <p className="text-muted-foreground">Registre entradas e ajustes de mercadoria.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome ou SKU..." 
            className="pl-8" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryId?.toString() || "all"} onValueChange={(v) => setCategoryId(v === "all" ? null : Number(v))}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories?.map(c => (
              <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Movimentar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [1, 2, 3, 4].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-6 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : products?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center">
                    <Package className="h-10 w-10 mb-2 opacity-20" />
                    Nenhum produto encontrado.
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              products?.map((prod) => (
                <TableRow key={prod.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{prod.name}</div>
                    <div className="text-xs text-muted-foreground">SKU: {prod.sku || "-"} • Fornecedor: {prod.supplierName || "-"}</div>
                  </TableCell>
                  <TableCell>{prod.categoryName || "-"}</TableCell>
                  <TableCell>
                    {getStockBadge(prod.stockStatus, prod.stockQuantity, prod.minStock)}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenDialog(prod, "entry")}>
                      <PackagePlus className="w-4 h-4 mr-1" /> Entrada
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {movementType === "entry" ? "Registrar Entrada" : "Ajuste de Estoque"}
            </DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="grid gap-4 py-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="font-medium">{selectedProduct.name}</div>
                <div className="text-sm text-muted-foreground">Estoque Atual: {selectedProduct.stockQuantity} {selectedProduct.unit}</div>
              </div>
              
              <div className="grid gap-2">
                <Label>Quantidade {movementType === "entry" ? "Recebida" : "Correta (Novo Saldo)"}</Label>
                <Input type="number" min="1" value={formData.quantity || ""} onChange={(e) => setFormData({...formData, quantity: Number(e.target.value)})} autoFocus />
              </div>
              
              {movementType === "entry" && (
                <div className="grid gap-2">
                  <Label>Nº Nota Fiscal (Opcional)</Label>
                  <Input value={formData.invoiceNumber} onChange={(e) => setFormData({...formData, invoiceNumber: e.target.value})} />
                </div>
              )}
              
              <div className="grid gap-2">
                <Label>Observações</Label>
                <Input value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} placeholder={movementType === "adjustment" ? "Ex: Quebra, avaria, recontagem..." : ""} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createStockMovement.isPending}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}