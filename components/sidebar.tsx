"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity,
  AlertTriangle,
  BarChart,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardListIcon,
  Image,
  LayoutDashboard,
  LogOut,
  Package,
  Puzzle,
  Settings,
  TestTube,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { useMedplumAuth } from "@/lib/auth-medplum";
import { getEnabledModules } from "@/lib/modules";

type SidebarModule = {
  id: string;
  label: string;
  routePath: string;
  icon?: string;
};

type SidebarProps = {
  modules?: SidebarModule[];
};

const baseNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Patients", href: "/patients", icon: Users },
  { name: "Orders", href: "/orders", icon: ClipboardListIcon },
];

const bottomNavigation = [
  { name: "Settings", href: "/settings", icon: Settings },
];

const moduleIconMap: Record<string, LucideIcon> = {
  AlertTriangle,
  TestTube,
  Image,
  Package,
  Calendar,
  BarChart,
};

export default function Sidebar({ modules = [] }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, loading, signOut, userLabel } = useMedplumAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [enabledModules, setEnabledModules] = useState<Array<{ name: string; href: string; icon: LucideIcon }>>([]);

  // Load enabled modules dynamically
  useEffect(() => {
    const loadModules = () => {
      const enabled = getEnabledModules();
      const moduleNav = enabled
        .filter(module => module.route) // Only modules with routes
        .map(module => ({
          name: module.name,
          href: module.route!,
          icon: moduleIconMap[module.icon as keyof typeof moduleIconMap] ?? Puzzle,
        }));
      setEnabledModules(moduleNav);
    };

    loadModules();

    // Listen for module toggle events
    const handleModuleChange = () => {
      loadModules();
    };

    window.addEventListener('moduleToggle', handleModuleChange);
    window.addEventListener('modulesReset', handleModuleChange);

    return () => {
      window.removeEventListener('moduleToggle', handleModuleChange);
      window.removeEventListener('modulesReset', handleModuleChange);
    };
  }, []);

  const navigation = useMemo(() => {
    // Combine base navigation with enabled modules
    return [...baseNavigation, ...enabledModules];
  }, [enabledModules]);

  // Hide sidebar entirely on public routes.
  if (
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/landing') ||
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/signup')
  ) {
    return null;
  }

  return (
    <div className={cn(
      "flex h-screen border-r bg-background relative transition-all duration-300",
      isCollapsed ? "w-16" : "w-64"
    )}>
      <div className="flex flex-col flex-1">
        <div className="flex h-14 items-center border-b px-4 justify-between">
          {!isCollapsed && (
            <Link href="/" className="flex items-center space-x-2">
              <Activity className="h-6 w-6" />
              <span className="text-xl font-bold">MediFlow</span>
            </Link>
          )}
          {isCollapsed && <Activity className="h-6 w-6 mx-auto" />}
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
        <ScrollArea className="flex-1">
          <nav className="flex flex-1 flex-col p-2 gap-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  prefetch={true}
                  className={cn(
                    "flex items-center rounded-lg text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                    isCollapsed ? "justify-center w-8 h-8 p-2 mx-auto" : "px-3 py-2"
                  )}
                  title={isCollapsed ? item.name : undefined}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {!isCollapsed && <span className="ml-2">{item.name}</span>}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>
        
        <div className="mt-auto border-t">
          {/* Theme Toggle */}
          <div className={cn(
            "p-2",
            isCollapsed ? "hidden" : "px-4"
          )}>
            <ThemeToggle />
          </div>
          
          {/* Bottom Navigation */}
          <div className="p-2 space-y-1">
            {bottomNavigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                prefetch={true}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  isCollapsed ? "justify-center w-8 h-8 p-2 mx-auto" : "px-3 py-2"
                )}
                title={isCollapsed ? item.name : undefined}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!isCollapsed && <span className="ml-2">{item.name}</span>}
              </Link>
            ))}
            {!loading && isAuthenticated ? (
              <div className="space-y-1">
                {!isCollapsed && userLabel && (
                  <div className="px-3 pt-1 text-xs text-muted-foreground truncate" title={userLabel}>
                    {userLabel}
                  </div>
                )}
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full text-muted-foreground hover:text-accent-foreground",
                    isCollapsed ? "justify-center w-8 h-8 p-2 mx-auto" : "justify-start px-3 py-2"
                  )}
                  onClick={async () => {
                    await signOut();
                    router.replace('/login');
                  }}
                  title={isCollapsed ? (userLabel ? `Logout ${userLabel}` : "Logout") : undefined}
                >
                  <LogOut className="h-4 w-4 flex-shrink-0" />
                  {!isCollapsed && <span className="ml-2">Logout</span>}
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                className={cn(
                  "w-full text-muted-foreground hover:text-accent-foreground",
                  isCollapsed ? "justify-center w-8 h-8 p-2 mx-auto" : "justify-start px-3 py-2"
                )}
                asChild
              >
                <Link href="/login" title={isCollapsed ? "Login" : undefined}>
                  <LogOut className="h-4 w-4 flex-shrink-0 rotate-180" />
                  {!isCollapsed && <span className="ml-2">Login</span>}
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
