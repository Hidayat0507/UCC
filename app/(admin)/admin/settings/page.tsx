import Link from "next/link";
import { headers } from "next/headers";
import { adminPathForHost } from "@/lib/admin-routes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Server, Shield, Wrench } from "lucide-react";
import { getHostFromHeaders } from "@/lib/server/subdomain-host";

export default async function AdminSettingsPage() {
  const host = getHostFromHeaders(await headers());
  const adminPath = (path: string) => adminPathForHost(path, host);
  const medplumUi =
    process.env.NEXT_PUBLIC_MEDPLUM_UI_URL || "https://medplum.drhidayat.com";
  const medplumApi =
    process.env.NEXT_PUBLIC_MEDPLUM_BASE_URL ||
    "https://medplum-api.drhidayat.com";
  const baseDomain =
    process.env.NEXT_PUBLIC_BASE_DOMAIN || "yourdomain.com";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Platform configuration and developer tools.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-4 w-4" /> Platform
          </CardTitle>
          <CardDescription>Runtime configuration for this deployment.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Base domain</span>
            <Badge variant="outline">{baseDomain}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Medplum API</span>
            <a
              href={medplumApi}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs inline-flex items-center gap-1 hover:underline"
            >
              {medplumApi}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Medplum Console</span>
            <a
              href={medplumUi}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs inline-flex items-center gap-1 hover:underline"
            >
              {medplumUi}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" /> Security
          </CardTitle>
          <CardDescription>
            Admin portal is gated behind the platform admin role. See
            <code className="mx-1 text-xs">docs/AUTH.md</code> for details.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-4 w-4" /> Developer Tools
          </CardTitle>
          <CardDescription>
            Utilities for bootstrapping and debugging the Medplum project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" asChild>
            <Link href={adminPath("/create-medplum-client")}>
              Create Medplum client credentials
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
