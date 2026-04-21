"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Medication } from "@/lib/inventory";
import { MEDICATION_CATEGORIES } from "@/lib/constants";

interface AddMedicationFormProps {
  onSubmit: (data: Omit<Medication, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
}

export function AddMedicationForm({ onSubmit, onCancel }: AddMedicationFormProps) {
  const [category, setCategory] = React.useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    const medicationData = {
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
    form.reset();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Medication Name</Label>
          <Input id="name" name="name" placeholder="Enter medication name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={category} onValueChange={setCategory} required>
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
          <Input id="dosageForm" name="dosageForm" placeholder="Enter dosage form" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stock">Initial Stock</Label>
          <Input
            id="stock"
            name="stock"
            type="number"
            min="0"
            placeholder="Enter initial stock"
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
            required
          />
        </div>
      </div>
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save Medication</Button>
      </div>
    </form>
  );
}
