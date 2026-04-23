"use client";

import { usePathname } from "next/navigation";
import { adminPathForPathname } from "@/lib/admin-routes";

export function useAdminPath() {
  const pathname = usePathname();
  return (path: string) => adminPathForPathname(path, pathname);
}
