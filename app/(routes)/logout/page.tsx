"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMedplumAuth } from "@/lib/auth-medplum";

export default function LogoutPage() {
  const router = useRouter();
  const { signOut } = useMedplumAuth();

  useEffect(() => {
    (async () => {
      try {
        await signOut();
        await fetch('/api/auth/medplum-session', { method: 'DELETE' }).catch(() => {});
      } catch (error) {
        console.error('Logout error:', error);
      }
      router.replace('/login');
    })();
  }, [router, signOut]);

  return <div className="p-6 text-sm text-muted-foreground">Signing you out…</div>;
}

