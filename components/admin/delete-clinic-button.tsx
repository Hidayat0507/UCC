"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

interface DeleteClinicButtonProps {
  clinicId: string;
  clinicName: string;
}

export default function DeleteClinicButton({
  clinicId,
  clinicName,
}: DeleteClinicButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Delete ${clinicName}? This only works when the clinic has no branches and no assigned users.`
    );
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete clinic");
      }

      toast({
        title: "Clinic deleted",
        description: `${clinicName} has been removed.`,
      });
      router.refresh();
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
      {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      Delete
    </Button>
  );
}
