"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Image as ImageIcon, Clock, CheckCircle, AlertCircle, FileText, Settings } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { isModuleEnabled } from "@/lib/modules";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function PACSPage() {
  const [moduleEnabled] = useState(() => isModuleEnabled('pacs'));

  if (!moduleEnabled) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ImageIcon aria-hidden className="h-8 w-8" />
            PACS - Medical Imaging
          </h1>
          <p className="text-muted-foreground mt-2">
            Picture Archiving and Communication System
          </p>
        </div>

        <Alert>
          <Settings className="h-4 w-4" />
          <AlertTitle>Module Not Enabled</AlertTitle>
          <AlertDescription>
            The PACS module is currently disabled. To use this feature, please enable it in Settings.
            <div className="mt-4">
              <Button asChild>
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Go to Settings
                </Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ImageIcon aria-hidden className="h-8 w-8" />
            PACS - Medical Imaging
          </h1>
          <p className="text-muted-foreground mt-2">
            Picture Archiving and Communication System
          </p>
        </div>
        <Button asChild>
          <Link href="/pacs/new">
            <Plus className="mr-2 h-4 w-4" /> New Imaging Order
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Studies</CardTitle>
            <ImageIcon aria-hidden className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Total studies ordered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Upcoming appointments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Reports</CardTitle>
            <FileText className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Awaiting interpretation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Critical Findings</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Urgent attention needed</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="scheduled" className="space-y-4">
        <TabsList>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="pending">Pending Reports</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="all">All Studies</TabsTrigger>
        </TabsList>

        <TabsContent value="scheduled">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Studies</CardTitle>
              <CardDescription>Imaging studies scheduled for today</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No scheduled studies</p>
                <Button asChild variant="link" className="mt-2">
                  <Link href="/pacs/new">Order a new study</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Reports</CardTitle>
              <CardDescription>Studies awaiting radiologist interpretation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pending reports</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed">
          <Card>
            <CardHeader>
              <CardTitle>Completed Studies</CardTitle>
              <CardDescription>Studies with final reports available</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No completed studies today</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Studies</CardTitle>
              <CardDescription>Complete imaging history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <ImageIcon aria-hidden className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No imaging studies recorded</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
