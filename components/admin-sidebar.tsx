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
  GitBranch,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  Activity,
  ChevronLeft,
  ChevronRight,
  Puzzle,
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
    { name: "Organisations", href: adminPath("/organisation"), icon: Building2 },
    { name: "Branches", href: adminPath("/clinics"), icon: GitBranch },
    { name: "Users", href: adminPath("/users"), icon: Users },
    { name: "Modules", href: adminPath("/modules"), icon: Puzzle },
    { name: "Settings", href: adminPath("/settings"), icon: Settings },
  ];

  if (pathname?.startsWith("/login")) return null;

  return (
    <div
      className={cn(
        "relative flex h-screen shrink-0 border-r bg-background transition-all duration-300",
        isCollapsed ? "w-16" : "w-16 md:w-40"
      )}
    >
      <div className="flex flex-col flex-1">
        {/* Header */}
        <div className="flex h-14 items-center justify-center border-b px-2 md:justify-between md:px-4">
          {!isCollapsed && (
            <Link href={adminPath("/")} className="flex items-center space-x-2">
              <Activity className="h-6 w-6 text-primary" />
              <div className="hidden md:block">
                <p className="text-sm font-bold leading-none">Iatrum</p>
                <p className="text-xs text-muted-foreground">Admin Portal</p>
              </div>
            </Link>
          )}
          {isCollapsed && <Activity className="h-6 w-6 mx-auto text-primary" />}
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-16 z-50 h-11 w-11 rounded-full border bg-background md:-right-4 md:h-8 md:w-8"
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
                    ? "mx-auto h-11 w-11 justify-center p-2 md:h-8 md:w-8"
                    : "justify-center p-2 md:justify-start md:px-3 md:py-2"
                )}
                title={isCollapsed ? item.name : undefined}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!isCollapsed && (
                  <span className="ml-2 hidden md:inline">{item.name}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="mt-auto border-t">
          {!isCollapsed && (
            <div className="hidden px-4 py-2 md:block">
              <ThemeToggle />
            </div>
          )}
          {!isCollapsed && (
            <div className="px-2 py-2 md:hidden">
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
                    ? "mx-auto h-11 w-11 justify-center p-2 md:h-8 md:w-8"
                    : "justify-center p-2 md:justify-start md:px-3 md:py-2"
                )}
                onClick={async () => {
                  await signOut();
                  router.replace("/login");
                }}
                title={isCollapsed ? "Logout" : undefined}
              >
                <LogOut className="h-4 w-4 flex-shrink-0" />
                {!isCollapsed && (
                  <span className="ml-2 hidden md:inline">Logout</span>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
