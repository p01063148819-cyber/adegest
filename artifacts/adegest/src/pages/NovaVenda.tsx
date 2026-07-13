import { useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useListProducts, getListProductsQueryKey, useCreateSale, CreateSaleItemBody } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, ShoppingBag, Plus, Minus, Trash2, ArrowRight, CreditCard, Banknote, QrCode, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ComboOptionsDialog } from "@/components/ComboOptionsDialog";

interface CartItem {
  product: any;
  quantity: number;
  selectedOptionIds?: number[];
  selectedOptions?: { groupId: number; groupName: string; optionId: number; optionName: string }[];
}

function cartKey(item: { product: { id: number }; selectedOptionIds?: number[] }): string {
  const options = [...(item.selectedOptionIds ?? [])].sort((a, b) => a - b).join(",");
  return `${item.product.id}:${options}`;
}

export default function NovaVenda() {
  const [_, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const { data: products } = useListProducts({ search: search || undefined }, {
    query: { queryKey: getListProductsQueryKey({ search: search || undefined }) }
  });

  const createSale = useCreateSale();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [pendingComboProduct, setPendingComboProduct] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"dinheiro" | "cartao" | "pix">("cartao");
  const [discountInput, setDiscountInput] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const stockByProductId = useMemo(() => {
    const map = new Map<number, number>();
    for (const p of products ?? []) map.set(p.id, p.stockQuantity);
    return map;
  }, [products]);

  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.product.salePrice * item.quantity), 0);
  }, [cart]);

  const discount = Number(discountInput) || 0;
  const total = Math.max(0, subtotal - discount);

  const addLineToCart = (product: any, selectedOptionIds?: number[], selectedOptions?: CartItem["selectedOptions"]) => {
    const key = cartKey({ product, selectedOptionIds });
    setCart(prev => {
      const existing = prev.find(item => cartKey(item) === key);
      const alreadyInCart = prev.filter(item => item.product.id === product.id).reduce((sum, item) => sum + item.quantity, 0);
      if (alreadyInCart >= product.stockQuantity) {
        toast({ title: "Estoque insuficiente", variant: "destructive" });
        return prev;
      }
      if (existing) {
        return prev.map(item => cartKey(item) === key ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1, selectedOptionIds, selectedOptions }];
    });
  };

  const addToCart = (product: any) => {
    const requiredGroups = (product.optionGroups ?? []).filter((g: any) => g.required);
    if (product.isCombo && requiredGroups.length > 0) {
      setPendingComboProduct(product);
      return;
    }

    if (product.stockQuantity <= 0) {
      toast({ title: "Produto sem estoque", variant: "destructive" });
      return;
    }
    addLineToCart(product);

    if (search.length > 0) {
      setSearch("");
      searchInputRef.current?.focus();
    }
  };

  const handleConfirmComboOptions = (selectedOptionIds: number[]) => {
    if (!pendingComboProduct) return;
    const selectedOptions = (pendingComboProduct.optionGroups ?? [])
      .flatMap((g: any) => g.options.map((o: any) => ({ groupId: g.id, groupName: g.name, optionId: o.id, optionName: o.name })))
      .filter((o: any) => selectedOptionIds.includes(o.optionId));

    addLineToCart(pendingComboProduct, selectedOptionIds, selectedOptions);
    setPendingComboProduct(null);

    if (search.length > 0) {
      setSearch("");
      searchInputRef.current?.focus();
    }
  };

  const updateQuantity = (item: CartItem, delta: number) => {
    const key = cartKey(item);
    setCart(prev => prev.map(c => {
      if (cartKey(c) !== key) return c;
      const alreadyInCart = prev.filter(other => other.product.id === c.product.id).reduce((sum, other) => sum + other.quantity, 0);
      const newQ = c.quantity + delta;
      if (delta > 0 && alreadyInCart >= c.product.stockQuantity) {
        toast({ title: "Estoque insuficiente", variant: "destructive" });
        return c;
      }
      return { ...c, quantity: Math.max(1, newQ) };
    }));
  };

  const removeFromCart = (item: CartItem) => {
    const key = cartKey(item);
    setCart(prev => prev.filter(c => cartKey(c) !== key));
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;

    const items: CreateSaleItemBody[] = cart.map(item => ({
      productId: item.product.id,
      quantity: item.quantity,
      discount: 0, // item level discount not implemented in UI yet
      selectedOptionIds: item.selectedOptionIds,
    }));

    createSale.mutate({
      data: {
        paymentMethod,
        discount: discount > 0 ? discount : undefined,
        items
      }
    }, {
      onSuccess: () => {
        toast({ title: "Venda concluída com sucesso!" });
        setLocation("/vendas");
      },
      onError: (err: any) => {
        toast({ title: "Erro ao registrar venda", description: err.message || "Tente novamente", variant: "destructive" });
      }
    });
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Products Selection Area */}
      <div className="flex-1 flex flex-col gap-4">
        <h1 className="text-3xl font-serif font-bold text-foreground mb-2">Ponto de Venda</h1>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Buscar produto por nome ou código..."
            className="pl-10 text-lg py-6"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <ScrollArea className="flex-1 bg-card rounded-xl border border-border p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {products?.map(prod => {
              const inCart = cart.filter(c => c.product.id === prod.id).reduce((sum, c) => sum + c.quantity, 0);
              const available = prod.stockQuantity - inCart;
              const isOutOfStock = available <= 0;

              return (
                <Card
                  key={prod.id}
                  className={`cursor-pointer transition-all hover:border-primary/50 ${isOutOfStock ? 'opacity-50' : 'hover:shadow-md'}`}
                  onClick={() => !isOutOfStock && addToCart(prod)}
                >
                  <CardContent className="p-4 flex flex-col h-full justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm line-clamp-2 flex items-center gap-1">
                        {prod.isCombo && <Layers className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />}
                        {prod.name}
                      </div>
                      <div className="text-xs text-muted-foreground">{prod.unit}</div>
                    </div>
                    <div className="flex items-end justify-between mt-2">
                      <div className="font-bold text-primary">{formatCurrency(prod.salePrice)}</div>
                      <div className={`text-xs ${isOutOfStock ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                        {available} disp.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {products?.length === 0 && (
               <div className="col-span-full py-12 text-center text-muted-foreground">
                 Nenhum produto encontrado.
               </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Cart/Checkout Area */}
      <Card className="w-full lg:w-[400px] flex flex-col shadow-lg border-primary/20">
        <CardHeader className="border-b bg-muted/30 pb-4">
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            Carrinho
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 p-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-12 opacity-50">
                <ShoppingBag className="w-12 h-12 mb-4" />
                <p>Carrinho vazio</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map(item => (
                  <div key={cartKey(item)} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{item.product.name}</div>
                      {item.selectedOptions && item.selectedOptions.length > 0 && (
                        <div className="text-xs text-muted-foreground truncate">
                          {item.selectedOptions.map(o => o.optionName).join(", ")}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">{formatCurrency(item.product.salePrice)} un</div>
                    </div>
                    <div className="flex items-center gap-2 bg-muted rounded-md p-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm" onClick={() => updateQuantity(item, -1)}>
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm" onClick={() => updateQuantity(item, 1)}>
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="font-bold text-sm text-right min-w-[70px]">
                      {formatCurrency(item.product.salePrice * item.quantity)}
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10" onClick={() => removeFromCart(item)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>

        <CardFooter className="flex-col gap-4 border-t bg-muted/10 pt-4 p-4">
          <div className="w-full space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <Label className="text-sm text-muted-foreground">Desconto (R$)</Label>
              <Input
                type="number"
                className="w-24 h-8 text-right"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>

            <div className="pt-2 border-t flex justify-between items-center">
              <span className="font-bold text-lg">Total</span>
              <span className="font-bold text-2xl text-primary">{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="w-full space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Forma de Pagamento</Label>
            <ToggleGroup type="single" value={paymentMethod} onValueChange={(v: any) => v && setPaymentMethod(v)} className="justify-between w-full">
              <ToggleGroupItem value="dinheiro" aria-label="Dinheiro" className="flex-1 gap-2">
                <Banknote className="h-4 w-4" /> Dinheiro
              </ToggleGroupItem>
              <ToggleGroupItem value="cartao" aria-label="Cartão" className="flex-1 gap-2">
                <CreditCard className="h-4 w-4" /> Cartão
              </ToggleGroupItem>
              <ToggleGroupItem value="pix" aria-label="PIX" className="flex-1 gap-2">
                <QrCode className="h-4 w-4" /> PIX
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <Button
            className="w-full h-12 text-lg shadow-md"
            disabled={cart.length === 0 || createSale.isPending}
            onClick={handleCheckout}
          >
            <ArrowRight className="w-5 h-5 mr-2" />
            Finalizar Venda
          </Button>
        </CardFooter>
      </Card>

      <ComboOptionsDialog
        product={pendingComboProduct}
        stockByProductId={stockByProductId}
        onConfirm={handleConfirmComboOptions}
        onOpenChange={(open) => { if (!open) setPendingComboProduct(null); }}
      />
    </div>
  );
}
