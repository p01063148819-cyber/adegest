import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { Product, ComboOption } from "@workspace/api-client-react";

function optionAvailability(option: ComboOption, stockByProductId: Map<number, number>): number {
  if (option.components.length === 0) return Infinity;
  let limit = Infinity;
  for (const component of option.components) {
    const stock = stockByProductId.get(component.productId) ?? 0;
    const possible = Math.floor(stock / component.quantity);
    if (possible < limit) limit = possible;
  }
  return limit;
}

interface ComboOptionsDialogProps {
  product: Product | null;
  stockByProductId: Map<number, number>;
  onConfirm: (selectedOptionIds: number[]) => void;
  onOpenChange: (open: boolean) => void;
}

export function ComboOptionsDialog({ product, stockByProductId, onConfirm, onOpenChange }: ComboOptionsDialogProps) {
  const requiredGroups = (product?.optionGroups ?? []).filter((g) => g.required);
  const [selections, setSelections] = useState<Record<number, number>>({});

  useEffect(() => {
    setSelections({});
  }, [product?.id]);

  const allSelected = requiredGroups.every((g) => selections[g.id] !== undefined);

  const handleConfirm = () => {
    if (!allSelected) return;
    onConfirm(Object.values(selections));
  };

  return (
    <Dialog open={!!product} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{product?.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-5 py-2 max-h-[60vh] overflow-y-auto">
          {requiredGroups.map((group) => (
            <div key={group.id} className="grid gap-2">
              <Label>{group.name}</Label>
              <RadioGroup
                value={selections[group.id]?.toString() ?? ""}
                onValueChange={(v) => setSelections((prev) => ({ ...prev, [group.id]: Number(v) }))}
              >
                {group.options.map((option) => {
                  const available = optionAvailability(option, stockByProductId);
                  const disabled = available <= 0;
                  return (
                    <div key={option.id} className={`flex items-center justify-between gap-2 rounded-md border border-border p-2 ${disabled ? "opacity-50" : ""}`}>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value={option.id.toString()} id={`option-${option.id}`} disabled={disabled} />
                        <Label htmlFor={`option-${option.id}`} className="cursor-pointer font-normal">
                          {option.name}
                        </Label>
                      </div>
                      {disabled && <span className="text-xs text-destructive">sem estoque</span>}
                    </div>
                  );
                })}
              </RadioGroup>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!allSelected}>Adicionar ao carrinho</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
