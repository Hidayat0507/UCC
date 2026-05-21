import "./globals.css";
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import Toaster from "@/components/ui/toaster";
import { MedplumAuthProvider } from "@/lib/auth-medplum";
import { getHostFromHeaders } from "@/lib/server/subdomain-host";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "UCC EMR",
  description: "Modern Electronic Medical Records System",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerStore = await headers();
  const host = getHostFromHeaders(headerStore);
  const pathname = headerStore.get("x-pathname") ?? "";
  const isApexHost = (() => {
    const bare = (host ?? "").split(":")[0];
    if (!bare) return true;
    if (bare.startsWith("localhost") || /^\d{1,3}(\.\d{1,3}){3}/.test(bare)) return true;
    const parts = bare.split(".");
    if (parts.length < 3) return true;
    return parts[0] === "www";
  })();

  if (!isApexHost && pathname === "/") {
    redirect("/dashboard");
  }
  const isMarketingPage = isApexHost && pathname === "/";

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        {isMarketingPage ? (
          children
        ) : (
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            themes={["light", "warm"]}
            disableTransitionOnChange
          >
            <MedplumAuthProvider>
              {children}
              <Toaster />
            </MedplumAuthProvider>
          </ThemeProvider>
        )}
      </body>
    </html>
  );
}
