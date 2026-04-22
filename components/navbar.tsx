"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { 
  Activity, 
  FileText, 
  Settings, 
  Users 
} from "lucide-react";
import { useMedplumAuth } from "@/lib/auth-medplum";

export default function Navbar() {
  const { profile, signOut } = useMedplumAuth();
  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: Activity },
    { name: "Patients", href: "/patients", icon: Users },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-4">
        <Link href="/" className="flex items-center space-x-2">
          <Activity className="h-6 w-6" />
          <span className="text-xl font-bold">MediFlow</span>
        </Link>
        <nav className="flex items-center space-x-6 mx-6">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="text-sm font-medium transition-colors hover:text-primary flex items-center space-x-2"
            >
              <item.icon className="h-4 w-4" />
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center space-x-4">
          {profile ? (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await fetch('/api/auth/medplum-session', { method: 'DELETE' });
                } catch {}
                await signOut();
                if (typeof window !== 'undefined') window.location.assign('/login');
              }}
            >
              Logout
            </Button>
          ) : (
            <Button asChild size="sm" variant="default">
              <Link href="/login">Login</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}