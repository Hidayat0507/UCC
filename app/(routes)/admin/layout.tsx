import AdminSidebar from "@/components/admin-sidebar";
import { redirect } from "next/navigation";
import { getUserAccessContext, requirePlatformAdmin } from "@/lib/server/medplum-auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requirePlatformAdmin();
  } catch {
    const access = await getUserAccessContext().catch(() => null);
    const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
    if (access && !access.isPlatformAdmin && access.clinics.length === 1 && baseDomain) {
      redirect(`https://${access.clinics[0].subdomain}.${baseDomain}/dashboard`);
    }
    redirect("/login");
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto bg-muted/10">
        <div className="container p-8">{children}</div>
      </main>
    </div>
  );
}
