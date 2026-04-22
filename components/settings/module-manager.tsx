"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  TestTube, 
  Image, 
  Package, 
  Calendar, 
  BarChart,
  CheckCircle
} from "lucide-react";
import { MODULES, toggleModule, getAllModuleStates, type ModuleId } from "@/lib/modules";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

const ICON_MAP = {
  AlertTriangle,
  TestTube,
  Image,
  Package,
  Calendar,
  BarChart,
};

export function ModuleManager() {
  const [moduleStates, setModuleStates] = useState<Record<ModuleId, boolean>>(
    () => getAllModuleStates()
  );
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    // Listen for changes
    const handleModuleToggle = () => {
      const newStates = getAllModuleStates();
      setModuleStates(newStates);
    };

    const handleModulesReset = () => {
      const newStates = getAllModuleStates();
      setModuleStates(newStates);
    };

    window.addEventListener('moduleToggle', handleModuleToggle);
    window.addEventListener('modulesReset', handleModulesReset);

    return () => {
      window.removeEventListener('moduleToggle', handleModuleToggle);
      window.removeEventListener('modulesReset', handleModulesReset);
    };
  }, []);

  const handleToggle = (moduleId: ModuleId, enabled: boolean) => {
    toggleModule(moduleId, enabled);
    setModuleStates(prev => ({ ...prev, [moduleId]: enabled }));
    
    toast({
      title: enabled ? "Module Enabled" : "Module Disabled",
      description: `${MODULES[moduleId].name} has been ${enabled ? 'enabled' : 'disabled'}.`,
    });

    // Refresh to update navigation
    setTimeout(() => {
      router.refresh();
    }, 500);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'clinical':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-300';
      case 'diagnostic':
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-300';
      case 'administrative':
        return 'bg-green-500/10 text-green-700 dark:text-green-300';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-300';
    }
  };

  // Group modules by category
  const groupedModules = Object.values(MODULES).reduce((acc, module) => {
    if (!acc[module.category]) {
      acc[module.category] = [];
    }
    acc[module.category].push(module);
    return acc;
  }, {} as Record<string, typeof MODULES[ModuleId][]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Enable or disable features based on your clinic&apos;s needs
        </p>
      </div>

      {/* Clinical Modules */}
      {groupedModules.clinical && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">
            Clinical Modules
          </h3>
          {groupedModules.clinical.map((module) => {
            const IconComponent = ICON_MAP[module.icon as keyof typeof ICON_MAP];
            const isEnabled = moduleStates[module.id] ?? true;

            return (
              <Card key={module.id} className={isEnabled ? "" : "opacity-60"}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-start gap-3 flex-1">
                    {IconComponent && <IconComponent className="h-5 w-5 mt-0.5 text-muted-foreground" />}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Label htmlFor={module.id} className="text-base font-medium cursor-pointer">
                          {module.name}
                        </Label>
                        {isEnabled && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      <CardDescription className="text-sm">
                        {module.description}
                      </CardDescription>
                      <div className="mt-2">
                        <Badge variant="outline" className={getCategoryColor(module.category)}>
                          {module.category}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Switch
                    id={module.id}
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleToggle(module.id, checked)}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Diagnostic Modules */}
      {groupedModules.diagnostic && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">
            Diagnostic Modules
          </h3>
          {groupedModules.diagnostic.map((module) => {
            const IconComponent = ICON_MAP[module.icon as keyof typeof ICON_MAP];
            const isEnabled = moduleStates[module.id] ?? true;

            return (
              <Card key={module.id} className={isEnabled ? "" : "opacity-60"}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-start gap-3 flex-1">
                    {IconComponent && <IconComponent className="h-5 w-5 mt-0.5 text-muted-foreground" />}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Label htmlFor={module.id} className="text-base font-medium cursor-pointer">
                          {module.name}
                        </Label>
                        {isEnabled && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      <CardDescription className="text-sm">
                        {module.description}
                      </CardDescription>
                      <div className="mt-2">
                        <Badge variant="outline" className={getCategoryColor(module.category)}>
                          {module.category}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Switch
                    id={module.id}
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleToggle(module.id, checked)}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Administrative Modules */}
      {groupedModules.administrative && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">
            Administrative Modules
          </h3>
          {groupedModules.administrative.map((module) => {
            const IconComponent = ICON_MAP[module.icon as keyof typeof ICON_MAP];
            const isEnabled = moduleStates[module.id] ?? true;

            return (
              <Card key={module.id} className={isEnabled ? "" : "opacity-60"}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-start gap-3 flex-1">
                    {IconComponent && <IconComponent className="h-5 w-5 mt-0.5 text-muted-foreground" />}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Label htmlFor={module.id} className="text-base font-medium cursor-pointer">
                          {module.name}
                        </Label>
                        {isEnabled && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      <CardDescription className="text-sm">
                        {module.description}
                      </CardDescription>
                      <div className="mt-2">
                        <Badge variant="outline" className={getCategoryColor(module.category)}>
                          {module.category}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Switch
                    id={module.id}
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleToggle(module.id, checked)}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
