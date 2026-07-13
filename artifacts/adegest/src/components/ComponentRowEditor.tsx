import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ComboComponentInput } from "@workspace/api-client-react";

interface AvailableProduct {
  id: number;
  name: string;
}

interface ComponentRowEditorProps {
  components: ComboComponentInput[];
  onChange: (components: ComboComponentInput[]) => void;
  availableProducts: AvailableProduct[];
  addLabel?: string;
}

export function ComponentRowEditor({ components, onChange, availableProducts, addLabel = "+ Adicionar componente" }: ComponentRowEditorProps) {
  const updateRow = (index: number, patch: Partial<ComboComponentInput>) => {
    onChange(components.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const removeRow = (index: number) => {
    onChange(components.filter((_, i) => i !== index));
  };

  const addRow = () => {
    const firstAvailable = availableProducts.find((p) => !components.some((c) => c.productId === p.id));
    onChange([...components, { productId: firstAvailable?.id ?? 0, quantity: 1 }]);
  };

  return (
    <div className="space-y-2">
      {components.map((component, index) => (
        <div key={index} className="flex items-center gap-2">
          <Select
            value={component.productId ? component.productId.toString() : ""}
            onValueChange={(v) => updateRow(index, { productId: Number(v) })}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Selecione um produto..." />
            </SelectTrigger>
            <SelectContent>
              {availableProducts.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min="1"
            className="w-20"
            value={component.quantity || ""}
            onChange={(e) => updateRow(index, { quantity: Number(e.target.value) })}
          />
          <Button variant="ghost" size="icon" onClick={() => removeRow(index)}>
            <Trash2 className="w-4 h-4 text-destructive/70 hover:text-destructive" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={availableProducts.length === 0}>
        <Plus className="w-3.5 h-3.5 mr-1" />
        {addLabel}
      </Button>
    </div>
  );
}
