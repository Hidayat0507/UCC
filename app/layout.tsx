import "./globals.css";
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import Toaster from "@/components/ui/toaster";
import Sidebar from "@/components/sidebar";
import { MedplumAuthProvider } from "@/lib/auth-medplum";
import { listActiveModules } from "@/lib/module-registry";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "UCC EMR",
  description: "Modern Electronic Medical Records System",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const modules = await listActiveModules();
  const cookieStore = await cookies();
  const isAdminContext = cookieStore.get("medplum-is-admin")?.value === "true";

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          themes={["light", "dark", "v3"]}
          enableSystem
          disableTransitionOnChange
        >
          <MedplumAuthProvider>
            <div className="relative flex min-h-screen flex-col">
              <div className="flex flex-1">
                {!isAdminContext && (
                  <Sidebar
                    modules={modules.map((module) => ({
                      id: module.id,
                      label: module.label,
                      routePath: module.routePath,
                      icon: module.icon,
                    }))}
                  />
                )}
                <main className="flex-1 overflow-y-auto">
                  {isAdminContext ? children : <div className="container p-8">{children}</div>}
                </main>
              </div>
            </div>
            <Toaster />
          </MedplumAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
