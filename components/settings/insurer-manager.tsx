"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Plus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { fetchInsurers, addInsurer, updateInsurer, deleteInsurer, type Insurer } from "@/lib/insurers";

export function InsurerManager() {
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Insurer | null>(null);
  const [formData, setFormData] = useState({ name: "", value: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Insurer | null>(null);
  const { toast } = useToast();

  const load = async () => {
    try {
      setInsurers(await fetchInsurers());
    } catch {
      toast({ title: "Error", description: "Failed to load insurers", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = () => {
    setEditing(null);
    setFormData({ name: "", value: "" });
    setSaveError("");
    setOpen(true);
  };

  const handleEdit = (insurer: Insurer) => {
    setEditing(insurer);
    setFormData({ name: insurer.name, value: insurer.value });
    setSaveError("");
    setOpen(true);
  };

  const slugify = (name: string) =>
    name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

  const handleSave = async () => {
    const name = formData.name.trim();
    const value = formData.value.trim() || slugify(formData.name);

    if (!name || !value) {
      const message = "Name is required.";
      setSaveError(message);
      toast({ title: "Validation Error", description: message, variant: "destructive" });
      return;
    }

    setSaving(true);
    setSaveError("");
    try {
      if (editing?.id) {
        await updateInsurer(editing.id, { name, value });
        toast({ title: "Success", description: "Insurer updated" });
      } else {
        await addInsurer({ name, value });
        toast({ title: "Success", description: "Insurer added" });
      }
      setOpen(false);
      load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save insurer.";
      setSaveError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;

    try {
      await deleteInsurer(deleteTarget.id);
      toast({ title: "Success", description: "Insurer deleted" });
      setDeleteTarget(null);
      load();
    } catch {
      toast({ title: "Error", description: "Failed to delete insurer", variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Manage panel insurers available for selection during patient check-in.
        </p>
        <Button onClick={handleAdd} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Insurer
        </Button>
      </div>

      {insurers.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No insurers configured. Click &quot;Add Insurer&quot; to add one.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {insurers.map((insurer) => (
                <TableRow key={insurer.id}>
                  <TableCell>{insurer.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{insurer.value}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit insurer ${insurer.name}`}
                        title={`Edit insurer ${insurer.name}`}
                        onClick={() => handleEdit(insurer)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete insurer ${insurer.name}`}
                        title={`Delete insurer ${insurer.name}`}
                        onClick={() => setDeleteTarget(insurer)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Insurer" : "Add Insurer"}</DialogTitle>
            <DialogDescription>
              Panel insurers appear as payment method options during patient check-in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="insurer-name">Name</Label>
              <Input
                id="insurer-name"
                placeholder="e.g. Intracare Sdn Bhd"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value, value: slugify(e.target.value) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="insurer-value">Value (internal identifier)</Label>
              <Input
                id="insurer-value"
                placeholder="e.g. intracare_sdn_bhd"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Auto-generated from name. Used internally to identify this insurer.
              </p>
            </div>
          </div>
          <DialogFooter>
            {saveError ? (
              <p className="mr-auto text-sm text-destructive" role="alert">
                {saveError}
              </p>
            ) : null}
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete insurer?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `This will remove "${deleteTarget.name}" from panel insurer options.`
                : "This will remove the selected insurer from panel insurer options."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
