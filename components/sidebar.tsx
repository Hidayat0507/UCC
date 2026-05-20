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
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  Image,
  LogOut,
  MessageCircle,
  Package,
  Puzzle,
  Settings,
  TestTube,
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

const baseNavigation: Array<{ name: string; href: string; icon: LucideIcon }> = [];

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
  const { profile, signOut } = useMedplumAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [enabledModules, setEnabledModules] = useState<Array<{ name: string; href: string; icon: LucideIcon }>>([]);

  // Load enabled modules dynamically
  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const applyResponsiveCollapse = () => setIsCollapsed(media.matches);
    applyResponsiveCollapse();
    media.addEventListener("change", applyResponsiveCollapse);

    const loadModules = () => {
      const enabled = getEnabledModules();
      const moduleNav = enabled
        .filter((module) => module.route && !["triage", "poct", "pacs"].includes(module.id))
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
      media.removeEventListener("change", applyResponsiveCollapse);
      window.removeEventListener('moduleToggle', handleModuleChange);
      window.removeEventListener('modulesReset', handleModuleChange);
    };
  }, []);

  const navigation = useMemo(() => {
    // Combine base navigation with enabled modules.
    const items = [...baseNavigation, ...enabledModules];
    items.push({ name: "Follow Up", href: "/follow-up", icon: MessageCircle });
    items.push({ name: "Tasks", href: "/tasks", icon: ClipboardCheck });
    return items;
  }, [enabledModules]);

  // Hide sidebar entirely on public routes like login/logout
  if (
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/signup') ||
    pathname?.startsWith('/admin')
  ) {
    return null;
  }

  return (
    <div className={cn(
      "flex h-screen border-r bg-background relative transition-all duration-300",
      isCollapsed ? "w-16" : "w-40"
    )}>
      <div className="flex flex-col flex-1">
        <div className="flex h-14 items-center border-b px-4 justify-between">
          {!isCollapsed && (
            <Link href="/dashboard" className="flex items-center space-x-2">
              <Activity className="h-6 w-6" />
              <span className="text-xl font-bold">Iatrum</span>
            </Link>
          )}
          {isCollapsed && <Activity className="h-6 w-6 mx-auto" />}
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
        <ScrollArea className="flex-1">
          <nav className="flex flex-1 flex-col p-2 gap-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center rounded-lg text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                    isCollapsed ? "mx-auto h-11 w-11 justify-center p-2 md:h-8 md:w-8" : "px-3 py-2"
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
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  isCollapsed ? "mx-auto h-11 w-11 justify-center p-2 md:h-8 md:w-8" : "px-3 py-2"
                )}
                title={isCollapsed ? item.name : undefined}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!isCollapsed && <span className="ml-2">{item.name}</span>}
              </Link>
            ))}
            {profile ? (
              <Button
                variant="ghost"
                className={cn(
                  "w-full text-muted-foreground hover:text-accent-foreground",
                  isCollapsed ? "mx-auto h-11 w-11 justify-center p-2 md:h-8 md:w-8" : "justify-start px-3 py-2"
                )}
                onClick={async () => {
                  await signOut();
                  router.replace('/login');
                }}
                title={isCollapsed ? "Logout" : undefined}
              >
                <LogOut className="h-4 w-4 flex-shrink-0" />
                {!isCollapsed && <span className="ml-2">Logout</span>}
              </Button>
            ) : (
              <Button
                variant="ghost"
                className={cn(
                  "w-full text-muted-foreground hover:text-accent-foreground",
                  isCollapsed ? "mx-auto h-11 w-11 justify-center p-2 md:h-8 md:w-8" : "justify-start px-3 py-2"
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
