export const dynamic = 'force-dynamic';

import { getTriagedPatientsQueue } from '@/lib/models';
import QueueTable from '@/components/queue-table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function TriageQueuePage() {
  const patients = await getTriagedPatientsQueue();

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Triage Queue</h1>
        <p className="text-muted-foreground mt-2">
          View and manage today&apos;s triaged patients and consultation queue.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Queue</CardTitle>
          <CardDescription>
            Patients ordered by triage priority (1 = most urgent) and time added to queue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QueueTable patients={patients} />
        </CardContent>
      </Card>
    </div>
  );
}
