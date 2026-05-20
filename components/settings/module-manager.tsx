import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  BarChart,
  Calendar,
  Image,
  Package,
  TestTube,
} from "lucide-react";
import { MODULES, type ModuleId } from "@/lib/modules";

const ICON_MAP = {
  AlertTriangle,
  TestTube,
  Image,
  Package,
  Calendar,
  BarChart,
};

export function ModuleManager() {
  const groupedModules = Object.values(MODULES).reduce(
    (acc, module) => {
      if (!acc[module.category]) {
        acc[module.category] = [];
      }
      acc[module.category].push(module);
      return acc;
    },
    {} as Record<string, typeof MODULES[ModuleId][]>
  );

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "clinical":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
      case "diagnostic":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-300";
      case "administrative":
        return "bg-green-500/10 text-green-700 dark:text-green-300";
      default:
        return "bg-gray-500/10 text-gray-700 dark:text-gray-300";
    }
  };

  const renderGroup = (
    title: string,
    modules: typeof MODULES[ModuleId][] | undefined
  ) => {
    if (!modules?.length) return null;

    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase text-muted-foreground">
          {title}
        </h3>
        {modules.map((module) => {
          const IconComponent = ICON_MAP[module.icon as keyof typeof ICON_MAP];

          return (
            <Card key={module.id}>
              <CardContent className="flex items-start gap-3 p-4">
                {IconComponent && (
                  <IconComponent className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{module.name}</p>
                    <Badge
                      variant="outline"
                      className={getCategoryColor(module.category)}
                    >
                      {module.category}
                    </Badge>
                  </div>
                  <CardDescription className="mt-1 text-sm">
                    {module.description}
                  </CardDescription>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Available for branch-level configuration.
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        This is the platform module catalogue. The admin UI treats modules as
        branch capabilities; this page does not persist branch-specific module
        settings yet.
      </div>
      {renderGroup("Clinical Modules", groupedModules.clinical)}
      {renderGroup("Diagnostic Modules", groupedModules.diagnostic)}
      {renderGroup("Administrative Modules", groupedModules.administrative)}
    </div>
  );
}
