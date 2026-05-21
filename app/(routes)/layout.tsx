import Sidebar from "@/components/sidebar";
import { CLINIC_COOKIE, SESSION_COOKIE } from "@/lib/server/cookie-constants";
import { clinicExists } from "@/lib/server/clinic-validation";
import {
  getHostFromHeaders,
  resolvePortalPresentation,
} from "@/lib/server/subdomain-host";
import { listNavigationModulesForClinic } from "@/lib/module-registry";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function AppRoutesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const skipAuth =
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_DISABLE_AUTH === "true";
  const cookieStore = await cookies();
  const headerStore = await headers();
  const host = getHostFromHeaders(headerStore);
  const pathname = headerStore.get("x-pathname") ?? "";
  const { clinicIdForValidation: clinicId } = resolvePortalPresentation({
    host,
    pathname,
    clinicCookieValue: cookieStore.get(CLINIC_COOKIE)?.value,
  });

  const isApexHost = (() => {
    const bare = (host ?? "").split(":")[0];
    if (!bare) return true;
    if (bare.startsWith("localhost") || /^\d{1,3}(\.\d{1,3}){3}/.test(bare)) return true;
    const parts = bare.split(".");
    if (parts.length < 3) return true;
    return parts[0] === "www";
  })();
  const isRootPath = pathname === "/";

  if (!isApexHost && isRootPath) {
    redirect("/dashboard");
  }

  const isPublicPath =
    !pathname ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/logout") ||
    pathname.startsWith("/clinic-not-found") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next");

  if (clinicId && !isPublicPath) {
    const exists = await clinicExists(clinicId);
    if (!exists) {
      redirect("/clinic-not-found");
    }
  }

  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!skipAuth && !sessionToken && !isPublicPath) {
    redirect("/login");
  }

  const modules = await listNavigationModulesForClinic(clinicId).catch(() => []);

  return (
    <div className="flex h-screen flex-col">
      <div className="flex min-h-0 flex-1">
        <Sidebar
          modules={modules.map((module) => ({
            id: module.id,
            label: module.label,
            routePath: module.routePath,
            icon: module.icon,
          }))}
        />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="w-full p-4 sm:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
