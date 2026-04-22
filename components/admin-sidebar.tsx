"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { useMedplumAuth } from "@/lib/auth-medplum";
import { useAdminPath } from "@/hooks/use-admin-path";
import {
  Building2,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  Activity,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useMedplumAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const adminPath = useAdminPath();

  const navigation = [
    { name: "Overview", href: adminPath("/"), icon: LayoutDashboard, exact: true },
    { name: "Clinics", href: adminPath("/clinics"), icon: Building2 },
    { name: "Users", href: adminPath("/users"), icon: Users },
    { name: "Settings", href: adminPath("/settings"), icon: Settings },
  ];

  if (pathname?.startsWith("/login")) return null;

  return (
    <div
      className={cn(
        "flex h-screen border-r bg-background relative transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex flex-col flex-1">
        {/* Header */}
        <div className="flex h-14 items-center border-b px-4 justify-between">
          {!isCollapsed && (
            <Link href={adminPath("/")} className="flex items-center space-x-2">
              <Activity className="h-6 w-6 text-primary" />
              <div>
                <p className="text-sm font-bold leading-none">Iatrum</p>
                <p className="text-xs text-muted-foreground">Admin Portal</p>
              </div>
            </Link>
          )}
          {isCollapsed && <Activity className="h-6 w-6 mx-auto text-primary" />}
          <Button
            variant="ghost"
            size="sm"
            className="absolute -right-4 top-16 h-8 w-8 rounded-full border bg-background z-50"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-1">
          {navigation.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground",
                  isCollapsed
                    ? "justify-center w-8 h-8 p-2 mx-auto"
                    : "px-3 py-2"
                )}
                title={isCollapsed ? item.name : undefined}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!isCollapsed && <span className="ml-2">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="mt-auto border-t">
          {!isCollapsed && (
            <div className="px-4 py-2">
              <ThemeToggle />
            </div>
          )}
          <div className="p-2">
            {profile && (
              <Button
                variant="ghost"
                className={cn(
                  "w-full text-muted-foreground hover:text-accent-foreground",
                  isCollapsed
                    ? "justify-center w-8 h-8 p-2 mx-auto"
                    : "justify-start px-3 py-2"
                )}
                onClick={async () => {
                  await signOut();
                  router.replace("/login");
                }}
                title={isCollapsed ? "Logout" : undefined}
              >
                <LogOut className="h-4 w-4 flex-shrink-0" />
                {!isCollapsed && <span className="ml-2">Logout</span>}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
