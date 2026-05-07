import { useState } from "react";
import { useListSuppliers, getListSuppliersQueryKey, useCreateSupplier, useUpdateSupplier, useDeleteSupplier } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export default function Fornecedores() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: suppliers, isLoading } = useListSuppliers({ query: { queryKey: getListSuppliersQueryKey() } });
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", contact: "", phone: "", email: "" });

  const handleOpenDialog = (supplier?: any) => {
    if (supplier) {
      setEditingId(supplier.id);
      setFormData({
        name: supplier.name || "",
        contact: supplier.contact || "",
        phone: supplier.phone || "",
        email: supplier.email || "",
      });
    } else {
      setEditingId(null);
      setFormData({ name: "", contact: "", phone: "", email: "" });
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) return;

    if (editingId) {
      updateSupplier.mutate({ id: editingId, data: formData }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSuppliersQueryKey() });
          setIsDialogOpen(false);
          toast({ title: "Fornecedor atualizado." });
        }
      });
    } else {
      createSupplier.mutate({ data: formData }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSuppliersQueryKey() });
          setIsDialogOpen(false);
          toast({ title: "Fornecedor criado." });
        }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Excluir este fornecedor?")) {
      deleteSupplier.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSuppliersQueryKey() });
          toast({ title: "Fornecedor excluído." });
        }
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Fornecedores</h1>
          <p className="text-muted-foreground">Gerencie seus parceiros e distribuidores.</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Fornecedor
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome / Empresa</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : suppliers?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                   <div className="flex flex-col items-center justify-center">
                    <Users className="h-10 w-10 mb-2 opacity-20" />
                    Nenhum fornecedor cadastrado.
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              suppliers?.map((sup) => (
                <TableRow key={sup.id}>
                  <TableCell className="font-medium">{sup.name}</TableCell>
                  <TableCell>{sup.contact || "-"}</TableCell>
                  <TableCell>{sup.phone || "-"}</TableCell>
                  <TableCell>{sup.email || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(sup)}>
                      <Edit2 className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(sup.id)}>
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nome/Razão Social</Label>
              <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} autoFocus />
            </div>
            <div className="grid gap-2">
              <Label>Nome do Contato</Label>
              <Input value={formData.contact} onChange={(e) => setFormData({...formData, contact: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Telefone</Label>
              <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createSupplier.isPending || updateSupplier.isPending}>
              {editingId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}