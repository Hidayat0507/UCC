import { headers } from "next/headers";
import AdminSidebar from "@/components/admin-sidebar";
import { requirePlatformAdminPage } from "@/lib/server/medplum-auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hdrs = await headers();
  const pathname = hdrs.get("x-pathname") || "/admin";
  await requirePlatformAdminPage(pathname);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto bg-muted/10">
        <div className="container p-8">{children}</div>
      </main>
    </div>
  );
}
