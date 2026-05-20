import { ModuleManager } from "@/components/settings/module-manager";

export default function AdminModulesPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Module Catalogue</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review available platform capabilities. Branch-specific module
          controls belong on each branch page.
        </p>
      </div>
      <ModuleManager />
    </div>
  );
}
