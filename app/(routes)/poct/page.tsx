"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, TestTube, Clock, CheckCircle, AlertCircle, Settings } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { isModuleEnabled } from "@/lib/modules";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function POCTPage() {
  const [moduleEnabled] = useState(() => isModuleEnabled('poct'));

  if (!moduleEnabled) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <TestTube className="h-8 w-8" />
            Point of Care Testing (POCT)
          </h1>
          <p className="text-muted-foreground mt-2">
            On-site laboratory testing and results management
          </p>
        </div>

        <Alert>
          <Settings className="h-4 w-4" />
          <AlertTitle>Module Not Enabled</AlertTitle>
          <AlertDescription>
            The POCT module is currently disabled. To use this feature, please enable it in Settings.
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
            <TestTube className="h-8 w-8" />
            Point of Care Testing (POCT)
          </h1>
          <p className="text-muted-foreground mt-2">
            On-site laboratory testing and results management
          </p>
        </div>
        <Button asChild>
          <Link href="/poct/new">
            <Plus className="mr-2 h-4 w-4" /> New Test Order
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Tests</CardTitle>
            <TestTube className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Total tests ordered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Awaiting results</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Results ready</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Abnormal</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">Pending Tests</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="all">All Tests</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Tests</CardTitle>
              <CardDescription>Tests awaiting performance or results</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <TestTube className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pending tests</p>
                <Button asChild variant="link" className="mt-2">
                  <Link href="/poct/new">Order a new test</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed">
          <Card>
            <CardHeader>
              <CardTitle>Completed Tests</CardTitle>
              <CardDescription>Tests with results available</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No completed tests today</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Tests</CardTitle>
              <CardDescription>Complete test history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <TestTube className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No tests recorded</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
