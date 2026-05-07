import { useState } from "react";
import { useListProducts, getListProductsQueryKey, useCreateProduct, useUpdateProduct, useDeleteProduct, useListCategories, getListCategoriesQueryKey, useListSuppliers, getListSuppliersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Wine, Search, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";

export default function Produtos() {
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
  const { data: suppliers } = useListSuppliers({ query: { queryKey: getListSuppliersQueryKey() } });

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const defaultForm = {
    name: "",
    sku: "",
    categoryId: undefined as number | undefined,
    supplierId: undefined as number | undefined,
    costPrice: 0,
    salePrice: 0,
    stockQuantity: 0,
    minStock: 0,
    unit: "garrafa" as any
  };
  const [formData, setFormData] = useState(defaultForm);

  const handleOpenDialog = (product?: any) => {
    if (product) {
      setEditingId(product.id);
      setFormData({
        name: product.name,
        sku: product.sku || "",
        categoryId: product.categoryId || undefined,
        supplierId: product.supplierId || undefined,
        costPrice: product.costPrice,
        salePrice: product.salePrice,
        stockQuantity: product.stockQuantity,
        minStock: product.minStock,
        unit: product.unit,
      });
    } else {
      setEditingId(null);
      setFormData(defaultForm);
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) return;

    if (editingId) {
      updateProduct.mutate({ id: editingId, data: formData }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          setIsDialogOpen(false);
          toast({ title: "Produto atualizado." });
        }
      });
    } else {
      createProduct.mutate({ data: formData }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          setIsDialogOpen(false);
          toast({ title: "Produto criado." });
        }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Excluir este produto?")) {
      deleteProduct.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          toast({ title: "Produto excluído." });
        }
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Produtos</h1>
          <p className="text-muted-foreground">Catálogo completo da sua adega.</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Produto
        </Button>
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
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">Venda</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [1, 2, 3, 4].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-6 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-6 w-16 ml-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-6 w-16 ml-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : products?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center">
                    <Wine className="h-10 w-10 mb-2 opacity-20" />
                    Nenhum produto encontrado.
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              products?.map((prod) => (
                <TableRow key={prod.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{prod.name}</div>
                    <div className="text-xs text-muted-foreground">SKU: {prod.sku || "-"} • Unid: {prod.unit}</div>
                  </TableCell>
                  <TableCell>{prod.categoryName || "-"}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatCurrency(prod.costPrice)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(prod.salePrice)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(prod)}>
                      <Edit2 className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(prod.id)}>
                      <Trash2 className="w-4 h-4 text-destructive/70 hover:text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-2">
              <Label>Nome do Produto</Label>
              <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>SKU</Label>
                <Input value={formData.sku} onChange={(e) => setFormData({...formData, sku: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label>Unidade</Label>
                <Select value={formData.unit} onValueChange={(v: any) => setFormData({...formData, unit: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="garrafa">Garrafa</SelectItem>
                    <SelectItem value="un">Unidade</SelectItem>
                    <SelectItem value="cx6">Caixa (6)</SelectItem>
                    <SelectItem value="cx12">Caixa (12)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Categoria</Label>
                <Select value={formData.categoryId?.toString() || "none"} onValueChange={(v) => setFormData({...formData, categoryId: v === "none" ? undefined : Number(v)})}>
                  <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {categories?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Fornecedor</Label>
                <Select value={formData.supplierId?.toString() || "none"} onValueChange={(v) => setFormData({...formData, supplierId: v === "none" ? undefined : Number(v)})}>
                  <SelectTrigger><SelectValue placeholder="Sem fornecedor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem fornecedor</SelectItem>
                    {suppliers?.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Preço de Custo (R$)</Label>
                <Input type="number" step="0.01" min="0" value={formData.costPrice || ""} onChange={(e) => setFormData({...formData, costPrice: Number(e.target.value)})} />
              </div>
              <div className="grid gap-2">
                <Label>Preço de Venda (R$)</Label>
                <Input type="number" step="0.01" min="0" value={formData.salePrice || ""} onChange={(e) => setFormData({...formData, salePrice: Number(e.target.value)})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Estoque Atual</Label>
                <Input type="number" min="0" value={formData.stockQuantity || ""} onChange={(e) => setFormData({...formData, stockQuantity: Number(e.target.value)})} disabled={!!editingId} title={editingId ? "Use a tela de Estoque para ajustes" : ""} />
              </div>
              <div className="grid gap-2">
                <Label>Estoque Mínimo (Alerta)</Label>
                <Input type="number" min="0" value={formData.minStock || ""} onChange={(e) => setFormData({...formData, minStock: Number(e.target.value)})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createProduct.isPending || updateProduct.isPending}>
              {editingId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}