export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import { loadModulePage } from "@/lib/module-registry";

export default async function FollowUpPage() {
  const ModulePage = await loadModulePage("follow-up");

  if (!ModulePage) {
    notFound();
  }

  return <ModulePage />;
}
