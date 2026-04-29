"use client";

import { useEffect, useState } from "react";
import { useMedplumAuth } from "@/lib/auth-medplum";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function resolveAdminOrigin(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const { origin, protocol, hostname, port } = window.location;
  if (hostname === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return null;
  }

  const parts = hostname.split(".");
  const targetHost =
    parts.length >= 3
      ? ["admin", ...parts.slice(1)].join(".")
      : process.env.NEXT_PUBLIC_BASE_DOMAIN
        ? `admin.${process.env.NEXT_PUBLIC_BASE_DOMAIN}`
        : null;

  if (!targetHost || targetHost === hostname) {
    return origin;
  }

  const suffix = port ? `:${port}` : "";
  return `${protocol}//${targetHost}${suffix}`;
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const {
    signIn,
    loading: authLoading,
    isAuthenticated,
    isAdmin,
    clinicId: authenticatedClinicId,
  } = useMedplumAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      return;
    }

    const next = searchParams.get("next");
    const requestedNext = next && next.startsWith("/") ? next : undefined;
    const redirectUrl = requestedNext ?? (isAdmin ? "/admin" : "/dashboard");

    if (typeof window !== "undefined") {
      if (isAdmin) {
        const adminOrigin = resolveAdminOrigin();
        if (adminOrigin && adminOrigin !== window.location.origin) {
          window.location.href = `${adminOrigin}${redirectUrl}`;
          return;
        }
      } else if (authenticatedClinicId) {
        const base = process.env.NEXT_PUBLIC_BASE_DOMAIN;
        if (base && !isLocalHost(window.location.hostname) && !window.location.hostname.startsWith(`${authenticatedClinicId}.`)) {
          window.location.href = `${window.location.protocol}//${authenticatedClinicId}.${base}${redirectUrl}`;
          return;
        }
      }
    }

    router.replace(redirectUrl);
  }, [authLoading, authenticatedClinicId, isAdmin, isAuthenticated, router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const next = searchParams.get("next");
      const requestedNext = next && next.startsWith("/") ? next : undefined;
      const { isAdmin, redirectUrl, clinicId } = await signIn(email, password, requestedNext);

      if (typeof window !== "undefined") {
        if (isAdmin) {
          const adminOrigin = resolveAdminOrigin();
          if (adminOrigin && adminOrigin !== window.location.origin) {
            window.location.href = `${adminOrigin}${redirectUrl}`;
            return;
          }
        } else if (clinicId) {
          const base = process.env.NEXT_PUBLIC_BASE_DOMAIN;
          if (base && !isLocalHost(window.location.hostname) && !window.location.hostname.startsWith(`${clinicId}.`)) {
            window.location.href = `${window.location.protocol}//${clinicId}.${base}${redirectUrl}`;
            return;
          }
        }
      }

      router.replace(redirectUrl);
    } catch (error) {
      const raw = error instanceof Error ? error.message : "";
      let description = "Unable to sign in. Please try again.";

      if (raw.startsWith("AUTH_CREDENTIALS")) {
        description = "Incorrect email or password. Please check and try again.";
      } else if (raw.startsWith("AUTH_NETWORK")) {
        description =
          "Could not reach the authentication server. Check your internet connection or try again shortly.";
      } else if (raw.startsWith("AUTH_CLINIC")) {
        description =
          "This account must sign in from the correct clinic subdomain.";
      } else if (raw.startsWith("AUTH_FORBIDDEN")) {
        description =
          "Your account does not have access to this area.";
      } else if (raw.startsWith("AUTH_CONFIG")) {
        description =
          "Login succeeded but no session was created. This is a configuration issue — please contact support.";
      }

      toast({
        title: "Sign in failed",
        description,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center w-screen px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to your EMR account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="doctor@clinic.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
