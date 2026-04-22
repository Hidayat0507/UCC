"use client";

import * as React from "react";
import { ProcedureItem } from "@/lib/procedures";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Search } from "lucide-react";

interface ProceduresTableProps {
  procedures: ProcedureItem[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onCreate: (data: Omit<ProcedureItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdate: (id: string, data: Partial<ProcedureItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function ProceduresTable({ procedures, searchTerm, onSearchChange, onCreate, onUpdate, onDelete }: ProceduresTableProps) {
  const [editing, setEditing] = React.useState<ProcedureItem | null>(null);
  const [creating, setCreating] = React.useState(false);

  const filtered = procedures.filter(p => {
    const q = searchTerm.toLowerCase();
    const code = (p.codingCode || '').toLowerCase();
    return p.name.toLowerCase().includes(q) || code.includes(q) || (p.category || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search procedures..." value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} className="max-w-sm border-0 bg-transparent shadow-none focus-visible:ring-0" />
        </div>
        <Button onClick={() => setCreating(true)}>Add Procedure</Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Default Price</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No procedures match the current filter.
                </TableCell>
              </TableRow>
            ) : null}
            {filtered.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium text-slate-900">{p.name}</TableCell>
                <TableCell>{p.codingCode || '-'}</TableCell>
                <TableCell>
                  {p.category ? (
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                      {p.category}
                    </Badge>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>RM {p.defaultPrice.toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Procedure</DialogTitle>
          </DialogHeader>
          <ProcedureForm
            onSubmit={async (data) => {
              await onCreate(data);
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Procedure</DialogTitle>
          </DialogHeader>
          {editing && (
            <ProcedureForm
              initial={editing}
              onSubmit={async (data) => {
                await onUpdate(editing.id, data);
                setEditing(null);
              }}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProcedureForm({ initial, onSubmit, onCancel }: { initial?: Partial<ProcedureItem>, onSubmit: (data: Omit<ProcedureItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>, onCancel: () => void }) {
  const [name, setName] = React.useState(initial?.name || '');
  const [code, setCode] = React.useState(initial?.codingCode || '');
  const [system, setSystem] = React.useState(initial?.codingSystem || '');
  const [display, setDisplay] = React.useState(initial?.codingDisplay || '');
  const [category, setCategory] = React.useState(initial?.category || '');
  const [defaultPrice, setDefaultPrice] = React.useState<number>(typeof initial?.defaultPrice === 'number' ? (initial!.defaultPrice as number) : 0);
  const [notes, setNotes] = React.useState(initial?.notes || '');

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit({ name: name.trim(), codingCode: code.trim() || undefined, codingSystem: system.trim() || undefined, codingDisplay: display.trim() || undefined, category: category.trim() || undefined, defaultPrice: Number(defaultPrice) || 0, notes: notes.trim() || undefined });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <Label>Code</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <div>
          <Label>System</Label>
          <Input placeholder="http://snomed.info/sct" value={system} onChange={(e) => setSystem(e.target.value)} />
        </div>
        <div>
          <Label>Display</Label>
          <Input placeholder="Human-readable display" value={display} onChange={(e) => setDisplay(e.target.value)} />
        </div>
        <div>
          <Label>Category</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div>
          <Label>Default Price</Label>
          <Input type="number" min="0" step="0.01" value={defaultPrice} onChange={(e) => setDefaultPrice(Number(e.target.value))} />
        </div>
      </div>
      <div>
        <Label>Notes</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  );
}

