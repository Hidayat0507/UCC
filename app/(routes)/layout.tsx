import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserAccessContext } from "@/lib/server/medplum-auth";
import { getClinicIdFromHost } from "@/lib/server/clinic";

const PUBLIC_PATH_PREFIXES = ["/login", "/landing", "/api/"];

export default async function AppRoutesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerStore = await headers();
  const pathname = headerStore.get("x-current-path") || "/";
  const host = headerStore.get("host");

  if (
    pathname.startsWith("/admin") ||
    PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return children;
  }

  const clinicId = getClinicIdFromHost(host);
  if (!clinicId) {
    return children;
  }

  const access = await getUserAccessContext().catch(() => null);
  if (!access) {
    return children;
  }

  if (access.isPlatformAdmin) {
    return children;
  }

  const allowedClinic = access.clinics.find(
    (clinic) => clinic.subdomain === clinicId || clinic.id === clinicId
  );

  if (allowedClinic) {
    return children;
  }

  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
  if (baseDomain && access.clinics.length === 1) {
    redirect(`https://${access.clinics[0].subdomain}.${baseDomain}/dashboard`);
  }

  redirect("/login");
}
