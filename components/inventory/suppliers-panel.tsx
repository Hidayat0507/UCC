"use client";

import * as React from "react";
import { Pencil, Plus, Trash2, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { Supplier } from "@/lib/purchase-hub";

interface SuppliersPanelProps {
  suppliers: Supplier[];
  onCreate: (data: Omit<Supplier, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onUpdate: (id: string, data: Partial<Supplier>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function SuppliersPanel({
  suppliers,
  onCreate,
  onUpdate,
  onDelete,
}: SuppliersPanelProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<Supplier | null>(null);

  const filteredSuppliers = suppliers.filter((supplier) => {
    const query = searchTerm.toLowerCase();
    return (
      supplier.name.toLowerCase().includes(query) ||
      (supplier.contactPerson || "").toLowerCase().includes(query) ||
      (supplier.phone || "").toLowerCase().includes(query) ||
      (supplier.email || "").toLowerCase().includes(query)
    );
  });

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-xl">Suppliers</CardTitle>
          <p className="text-sm text-muted-foreground">
            Keep supplier records reusable across purchase orders.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Search suppliers"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="sm:w-64"
          />
          <Button onClick={() => setCreating(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add supplier
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-xl border border-slate-200/80">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead>Supplier</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No suppliers yet. Add one so purchase orders can stay supplier-based.
                  </TableCell>
                </TableRow>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                          <UserRound className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{supplier.name}</p>
                          {supplier.address ? (
                            <p className="line-clamp-1 text-xs text-muted-foreground">{supplier.address}</p>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{supplier.contactPerson || "-"}</TableCell>
                    <TableCell>{supplier.phone || "-"}</TableCell>
                    <TableCell>{supplier.email || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(supplier)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onDelete(supplier.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add supplier</DialogTitle>
          </DialogHeader>
          <SupplierForm
            onCancel={() => setCreating(false)}
            onSubmit={async (data) => {
              await onCreate(data);
              setCreating(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit supplier</DialogTitle>
          </DialogHeader>
          {editing ? (
            <SupplierForm
              initial={editing}
              onCancel={() => setEditing(null)}
              onSubmit={async (data) => {
                await onUpdate(editing.id, data);
                setEditing(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SupplierForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Supplier>;
  onSubmit: (data: Omit<Supplier, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = React.useState(initial?.name || "");
  const [contactPerson, setContactPerson] = React.useState(initial?.contactPerson || "");
  const [phone, setPhone] = React.useState(initial?.phone || "");
  const [email, setEmail] = React.useState(initial?.email || "");
  const [address, setAddress] = React.useState(initial?.address || "");
  const [notes, setNotes] = React.useState(initial?.notes || "");

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit({
          name: name.trim(),
          contactPerson: contactPerson.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="supplier-name">Supplier name</Label>
          <Input id="supplier-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier-contact">Contact person</Label>
          <Input id="supplier-contact" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier-phone">Phone</Label>
          <Input id="supplier-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier-email">Email</Label>
          <Input id="supplier-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="supplier-address">Address</Label>
        <Textarea id="supplier-address" value={address} onChange={(e) => setAddress(e.target.value)} rows={3} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="supplier-notes">Notes</Label>
        <Textarea id="supplier-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save supplier</Button>
      </div>
    </form>
  );
}
