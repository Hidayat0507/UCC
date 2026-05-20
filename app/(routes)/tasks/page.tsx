import { notFound } from "next/navigation";

import { loadEnabledModulePage } from "@/lib/module-registry";

export default async function TasksPage() {
  const ModulePage = await loadEnabledModulePage("tasks");

  if (!ModulePage) {
    notFound();
  }

  return <ModulePage />;
}
