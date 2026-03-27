"use client";

import { useState } from "react";
import { useMedplumAuth } from "@/lib/auth-medplum";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useMedplumAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { isAdmin } = await signIn(email, password);
      if (isAdmin) {
        const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
        if (baseDomain && typeof window !== "undefined") {
          const currentHost = window.location.hostname;
          if (currentHost === `admin.${baseDomain}`) {
            router.replace("/admin");
          } else {
            window.location.href = `${window.location.protocol}//admin.${baseDomain}/admin`;
          }
        } else {
          router.replace("/admin");
        }
      } else {
        router.replace("/dashboard");
      }
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
