import { useState } from "react";
import { useListProducts, getListProductsQueryKey, useCreateProduct, useUpdateProduct, useDeleteProduct, useListCategories, getListCategoriesQueryKey } from "@workspace/api-client-react";
import type { ComboComponentInput, ComboOptionGroupInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Wine, Search, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ComponentRowEditor } from "@/components/ComponentRowEditor";
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
    unit: "garrafa" as any,
    isCombo: false,
    fixedComponents: [] as ComboComponentInput[],
    optionGroups: [] as ComboOptionGroupInput[],
  };
  const [formData, setFormData] = useState(defaultForm);

  // Combos can't be used as components (no nested combos) and a product can't be its own component.
  const availableComponentProducts = (products ?? [])
    .filter((p) => !p.isCombo && p.id !== editingId)
    .map((p) => ({ id: p.id, name: p.name }));

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
        isCombo: product.isCombo ?? false,
        fixedComponents: (product.fixedComponents ?? []).map((c: any) => ({ productId: c.productId, quantity: c.quantity })),
        optionGroups: (product.optionGroups ?? []).map((g: any) => ({
          name: g.name,
          required: g.required,
          options: g.options.map((o: any) => ({
            name: o.name,
            components: o.components.map((c: any) => ({ productId: c.productId, quantity: c.quantity })),
          })),
        })),
      });
    } else {
      setEditingId(null);
      setFormData(defaultForm);
    }
    setIsDialogOpen(true);
  };

  const addGroup = () => {
    setFormData({ ...formData, optionGroups: [...formData.optionGroups, { name: "", required: true, options: [] }] });
  };
  const updateGroup = (index: number, patch: Partial<ComboOptionGroupInput>) => {
    setFormData({ ...formData, optionGroups: formData.optionGroups.map((g, i) => (i === index ? { ...g, ...patch } : g)) });
  };
  const removeGroup = (index: number) => {
    setFormData({ ...formData, optionGroups: formData.optionGroups.filter((_, i) => i !== index) });
  };
  const addOption = (groupIndex: number) => {
    updateGroup(groupIndex, { options: [...formData.optionGroups[groupIndex].options, { name: "", components: [] }] });
  };
  const updateOption = (groupIndex: number, optionIndex: number, patch: Partial<ComboOptionGroupInput["options"][number]>) => {
    const options = formData.optionGroups[groupIndex].options.map((o, i) => (i === optionIndex ? { ...o, ...patch } : o));
    updateGroup(groupIndex, { options });
  };
  const removeOption = (groupIndex: number, optionIndex: number) => {
    updateGroup(groupIndex, { options: formData.optionGroups[groupIndex].options.filter((_, i) => i !== optionIndex) });
  };

  const validateCombo = (): string | null => {
    if (!formData.isCombo) return null;
    for (const group of formData.optionGroups) {
      if (!group.name.trim()) return "Todo grupo de opção precisa ter um nome";
      if (group.options.length === 0) return `Grupo "${group.name}" precisa ter pelo menos uma opção`;
      for (const option of group.options) {
        if (!option.name.trim()) return `Toda opção do grupo "${group.name}" precisa ter um nome`;
        if (option.components.length === 0) return `Opção "${option.name}" precisa ter pelo menos um componente`;
      }
    }
    const hasRequiredGroupWithOptions = formData.optionGroups.some((g) => g.required && g.options.length > 0);
    if (formData.fixedComponents.length === 0 && !hasRequiredGroupWithOptions) {
      return "Um combo precisa ter pelo menos um componente fixo ou um grupo obrigatório com opções";
    }
    return null;
  };

  const handleSave = () => {
    if (!formData.name.trim()) return;

    const comboError = validateCombo();
    if (comboError) {
      toast({ title: "Combo incompleto", description: comboError, variant: "destructive" });
      return;
    }

    const payload = {
      name: formData.name,
      sku: formData.sku,
      categoryId: formData.categoryId,
      supplierId: formData.supplierId,
      costPrice: formData.costPrice,
      salePrice: formData.salePrice,
      stockQuantity: formData.stockQuantity,
      minStock: formData.minStock,
      unit: formData.unit,
      isCombo: formData.isCombo,
      fixedComponents: formData.isCombo ? formData.fixedComponents : [],
      optionGroups: formData.isCombo ? formData.optionGroups : [],
    };

    if (editingId) {
      updateProduct.mutate({ id: editingId, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          setIsDialogOpen(false);
          toast({ title: "Produto atualizado." });
        },
        onError: (err: any) => {
          toast({ title: "Erro ao salvar", description: err.message || "Tente novamente", variant: "destructive" });
        },
      });
    } else {
      createProduct.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          setIsDialogOpen(false);
          toast({ title: "Produto criado." });
        },
        onError: (err: any) => {
          toast({ title: "Erro ao salvar", description: err.message || "Tente novamente", variant: "destructive" });
        },
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Excluir este produto?")) {
      deleteProduct.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          toast({ title: "Produto excluído." });
        },
        onError: (err: any) => {
          toast({ title: "Erro ao excluir", description: err.message || "Tente novamente", variant: "destructive" });
        },
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
                    <div className="font-medium text-foreground flex items-center gap-2">
                      {prod.name}
                      {prod.isCombo && (
                        <Badge variant="secondary" className="gap-1">
                          <Layers className="w-3 h-3" /> Combo
                        </Badge>
                      )}
                    </div>
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
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[65vh] overflow-y-auto pr-1">
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
                <Label>Categoria</Label>
                <Select value={formData.categoryId?.toString() || "none"} onValueChange={(v) => setFormData({...formData, categoryId: v === "none" ? undefined : Number(v)})}>
                  <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {categories?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
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
                <Input
                  type="number"
                  min="0"
                  value={formData.isCombo ? "" : formData.stockQuantity || ""}
                  onChange={(e) => setFormData({...formData, stockQuantity: Number(e.target.value)})}
                  disabled={!!editingId || formData.isCombo}
                  placeholder={formData.isCombo ? "Calculado automaticamente" : ""}
                  title={editingId ? "Use a tela de Estoque para ajustes" : formData.isCombo ? "Calculado a partir dos componentes" : ""}
                />
              </div>
              <div className="grid gap-2">
                <Label>Estoque Mínimo (Alerta)</Label>
                <Input type="number" min="0" value={formData.minStock || ""} onChange={(e) => setFormData({...formData, minStock: Number(e.target.value)})} />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Este produto é um combo/kit</Label>
                <p className="text-xs text-muted-foreground">Composto por outros produtos, descontados do estoque na venda.</p>
              </div>
              <Switch checked={formData.isCombo} onCheckedChange={(checked) => setFormData({...formData, isCombo: checked})} />
            </div>

            {formData.isCombo && (
              <>
                <div className="grid gap-2">
                  <Label>Componentes fixos</Label>
                  <p className="text-xs text-muted-foreground -mt-1">Sempre descontados quando o combo é vendido.</p>
                  <ComponentRowEditor
                    components={formData.fixedComponents}
                    onChange={(components) => setFormData({...formData, fixedComponents: components})}
                    availableProducts={availableComponentProducts}
                  />
                </div>

                <Separator />

                <div className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Grupos de opção</Label>
                      <p className="text-xs text-muted-foreground">Opcional. O cliente escolhe uma opção de cada grupo na hora da venda.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addGroup}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar grupo
                    </Button>
                  </div>

                  {formData.optionGroups.map((group, groupIndex) => (
                    <div key={groupIndex} className="border border-border rounded-lg p-3 space-y-3 bg-muted/20">
                      <div className="flex items-center gap-2">
                        <Input
                          className="flex-1"
                          placeholder='Nome do grupo (ex: "Acompanhamento")'
                          value={group.name}
                          onChange={(e) => updateGroup(groupIndex, { name: e.target.value })}
                        />
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Switch checked={group.required} onCheckedChange={(checked) => updateGroup(groupIndex, { required: checked })} />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">Obrigatório</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeGroup(groupIndex)}>
                          <Trash2 className="w-4 h-4 text-destructive/70 hover:text-destructive" />
                        </Button>
                      </div>

                      <div className="space-y-3 pl-3 border-l-2 border-border">
                        {group.options.map((option, optionIndex) => (
                          <div key={optionIndex} className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Input
                                className="flex-1"
                                placeholder='Nome da opção (ex: "5 Red Bull + Gelo de Coco")'
                                value={option.name}
                                onChange={(e) => updateOption(groupIndex, optionIndex, { name: e.target.value })}
                              />
                              <Button variant="ghost" size="icon" onClick={() => removeOption(groupIndex, optionIndex)}>
                                <Trash2 className="w-4 h-4 text-destructive/70 hover:text-destructive" />
                              </Button>
                            </div>
                            <ComponentRowEditor
                              components={option.components}
                              onChange={(components) => updateOption(groupIndex, optionIndex, { components })}
                              availableProducts={availableComponentProducts}
                              addLabel="+ Adicionar componente da opção"
                            />
                          </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={() => addOption(groupIndex)}>
                          <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar opção
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
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
