"use client";

import * as React from "react";
import { Home, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  { key: "light" as const, icon: Sun, label: "Light" },
  { key: "warm" as const, icon: Home, label: "Warm" },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn(
          "inline-flex items-center bg-muted rounded-full p-1 h-[40px] w-[76px]",
          className,
        )}
      />
    );
  }

  const active = theme === "warm" ? theme : "light";

  return (
    <div className={cn("inline-flex items-center bg-muted rounded-full p-1 gap-0.5", className)}>
      {THEME_OPTIONS.map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => setTheme(key)}
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center transition-all duration-200",
            active === key
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          title={label}
          aria-label={`Switch to ${label} theme`}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
