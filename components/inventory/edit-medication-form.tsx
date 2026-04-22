import * as React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Medication } from "@/lib/inventory";
import { MEDICATION_CATEGORIES } from "@/lib/constants";

interface EditMedicationFormProps {
  medication: Medication;
  onSubmit: (data: Partial<Medication>) => Promise<void>;
  onCancel: () => void;
}

export function EditMedicationForm({ medication, onSubmit, onCancel }: EditMedicationFormProps) {
  const [category, setCategory] = React.useState(medication.category);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const medicationData: Partial<Medication> = {
      name: (formData.get('name') as string).trim(),
      category,
      dosageForm: (formData.get('dosageForm') as string).trim(),
      strengths: [], // You'll need to handle this separately
      stock: parseInt(formData.get('stock') as string),
      minimumStock: parseInt(formData.get('minimumStock') as string),
      unit: 'units',
      expiryDate: formData.get('expiryDate') as string,
      unitPrice: parseFloat(formData.get('unitPrice') as string),
    };

    await onSubmit(medicationData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Medication Name</Label>
          <Input 
            id="name" 
            name="name" 
            defaultValue={medication.name}
            placeholder="Enter medication name" 
            required 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {MEDICATION_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category.toLowerCase()}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dosageForm">Dosage Form</Label>
          <Input 
            id="dosageForm" 
            name="dosageForm" 
            defaultValue={medication.dosageForm}
            placeholder="Enter dosage form" 
            required 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stock">Current Stock</Label>
          <Input
            id="stock"
            name="stock"
            type="number"
            min="0"
            defaultValue={medication.stock}
            placeholder="Enter current stock"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="minimumStock">
            Minimum Stock Level
            <span className="text-sm text-muted-foreground ml-1">
              (Alert when stock is below this)
            </span>
          </Label>
          <Input
            id="minimumStock"
            name="minimumStock"
            type="number"
            min="0"
            defaultValue={medication.minimumStock}
            placeholder="Enter minimum stock level"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unitPrice">Unit Price (RM)</Label>
          <Input
            id="unitPrice"
            name="unitPrice"
            type="number"
            min="0"
            step="0.01"
            defaultValue={medication.unitPrice}
            placeholder="Enter unit price"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expiryDate">Expiry Date</Label>
          <Input
            id="expiryDate"
            name="expiryDate"
            type="date"
            defaultValue={medication.expiryDate}
            required
          />
        </div>
      </div>
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Save Changes
        </Button>
      </div>
    </form>
  );
}
