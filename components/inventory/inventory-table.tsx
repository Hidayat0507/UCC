"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search, Trash2, Pencil } from "lucide-react";
import { Medication } from "@/lib/inventory";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { EditMedicationForm } from "./edit-medication-form";

interface InventoryTableProps {
  medications: Medication[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onEdit: (id: string, data: Partial<Medication>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function InventoryTable({ 
  medications, 
  searchTerm, 
  onSearchChange,
  onEdit,
  onDelete 
}: InventoryTableProps) {
  const [editingMedication, setEditingMedication] = React.useState<Medication | null>(null);
  const [deletingMedication, setDeletingMedication] = React.useState<Medication | null>(null);

  const filteredMedications = medications.filter(
    (med) =>
      med.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      med.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2">
        <Search className="w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search medications..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value.trim())}
          className="max-w-sm border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Min. Stock</TableHead>
              <TableHead>Unit Price</TableHead>
              <TableHead>Expiry Date</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMedications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No medications match the current filter.
                </TableCell>
              </TableRow>
            ) : null}
            {filteredMedications.map((medication) => (
              <TableRow key={medication.id}>
                <TableCell>
                  <div className="space-y-1">
                    <p className="font-medium text-slate-900">{medication.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {medication.dosageForm || "Medication"} • {medication.unit}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                    {medication.category}
                  </Badge>
                </TableCell>
                <TableCell className={medication.stock <= medication.minimumStock ? "font-medium text-rose-600" : ""}>
                  {medication.stock} {medication.unit}
                </TableCell>
                <TableCell>{medication.minimumStock}</TableCell>
                <TableCell>RM {medication.unitPrice?.toFixed(2) || "0.00"}</TableCell>
                <TableCell>{medication.expiryDate || "-"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingMedication(medication)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingMedication(medication)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editingMedication} onOpenChange={() => setEditingMedication(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Medication</DialogTitle>
          </DialogHeader>
          {editingMedication && (
            <EditMedicationForm
              medication={editingMedication}
              onSubmit={async (data) => {
                await onEdit(editingMedication.id, data);
                setEditingMedication(null);
              }}
              onCancel={() => setEditingMedication(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingMedication} onOpenChange={() => setDeletingMedication(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Medication</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deletingMedication?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingMedication(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (deletingMedication) {
                  await onDelete(deletingMedication.id);
                  setDeletingMedication(null);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
