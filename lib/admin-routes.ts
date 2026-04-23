import { deriveSubdomainContext } from "@/lib/server/subdomain-host";

function ensureLeadingSlash(path: string): string {
  if (!path) {
    return "/";
  }
  return path.startsWith("/") ? path : `/${path}`;
}

export function normalizeAdminPath(path: string): string {
  const withSlash = ensureLeadingSlash(path);
  const stripped = withSlash.replace(/^\/admin(?=\/|$)/, "");
  return stripped || "/";
}

export function addAdminPrefix(path: string): string {
  const clean = normalizeAdminPath(path);
  return clean === "/" ? "/admin" : `/admin${clean}`;
}

export function adminPathForHost(path: string, host: string | null): string {
  const clean = normalizeAdminPath(path);
  return deriveSubdomainContext(host).type === "admin"
    ? clean
    : addAdminPrefix(clean);
}

export function adminPathForPathname(
  path: string,
  pathname: string | null
): string {
  const clean = normalizeAdminPath(path);
  return pathname?.startsWith("/admin") ? addAdminPrefix(clean) : clean;
}
