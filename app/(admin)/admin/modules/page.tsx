import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { adminPathForHost } from "@/lib/admin-routes";
import { getHostFromHeaders } from "@/lib/server/subdomain-host";

export default async function AdminModulesPage() {
  const host = getHostFromHeaders(await headers());
  redirect(adminPathForHost("/organisation", host));
}
