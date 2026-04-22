export const dynamic = 'force-dynamic';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Users, Calendar, TrendingUp } from "lucide-react";
import { getPatients, getConsultationsByPatientId } from "@/lib/models";
import AnalyticsCharts from "@/components/analytics/analytics-charts";
import { calculateAge } from "@/lib/utils";

export default async function AnalyticsPage() {
  const patients = await getPatients();
  // Fetch consultations for all patients (simple approach; can be optimized with an aggregate collection)
  const consultations = (
    await Promise.all(patients.map((p) => getConsultationsByPatientId(p.id)))
  ).flat();

  // Overview stats
  const totalPatients = patients.length;
  const thisMonth = new Date();
  thisMonth.setDate(1);
  const consultationsThisMonth = consultations.filter(c => c.date && new Date(c.date) >= thisMonth).length;

  // Revenue (sum of prices from prescriptions + procedures)
  const sumItems = (arr?: Array<{ price?: number }>) => (arr || []).reduce((s, it) => s + (it?.price ?? 0), 0);
  const revenueAllTime = consultations.reduce((s, c) => s + sumItems(c.prescriptions) + sumItems(c.procedures), 0);
  const revenueThisMonth = consultations
    .filter(c => c.date && new Date(c.date) >= thisMonth)
    .reduce((s, c) => s + sumItems(c.prescriptions) + sumItems(c.procedures), 0);

  // Compute wait time from queueAddedAt -> first consultation date per patient (if available)
  const waitTimes: number[] = patients
    .map(p => {
      const added = p.queueAddedAt ? new Date(p.queueAddedAt as any).getTime() : null;
      const firstC = consultations.find(c => c.patientId === p.id)?.date as any;
      const firstTime = firstC ? new Date(firstC).getTime() : null;
      return added && firstTime && firstTime > added ? Math.round((firstTime - added) / (60 * 1000)) : null;
    })
    .filter((v): v is number => typeof v === 'number');
  const avgWait = waitTimes.length ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length) : 0;

  // Gender pie
  const genderCounts: Record<string, number> = {};
  for (const p of patients) {
    genderCounts[p.gender] = (genderCounts[p.gender] ?? 0) + 1;
  }
  const genderData = Object.entries(genderCounts).map(([name, value]) => ({ name, value }));

  // Age buckets
  const buckets: Record<string, number> = { '0-17': 0, '18-39': 0, '40-64': 0, '65+': 0 };
  for (const p of patients) {
    if (!p.dateOfBirth) continue;
    const dob = new Date(p.dateOfBirth as any);
    if (isNaN(dob.getTime())) continue;
    const age = calculateAge(dob);
    if (age < 18) buckets['0-17']++; else if (age < 40) buckets['18-39']++; else if (age < 65) buckets['40-64']++; else buckets['65+']++;
  }
  const ageData = Object.entries(buckets).map(([name, value]) => ({ name, value }));

  // Weekly visits (last 7 days)
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const weeklyVisits = days.map(d => ({
    name: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: consultations.filter(c => c.date && new Date(c.date).toDateString() === d.toDateString()).length,
  }));

  // Top diagnoses
  const diagnosisCounts: Record<string, number> = {};
  for (const c of consultations) {
    if (!c.diagnosis) continue;
    diagnosisCounts[c.diagnosis] = (diagnosisCounts[c.diagnosis] ?? 0) + 1;
  }
  const diagnosisTop = Object.entries(diagnosisCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));

  // Revenue by month (last 12 months)
  const now = new Date();
  const months: { name: string; year: number; month: number }[] = Array.from({ length: 12 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    return { name: d.toLocaleDateString('en-US', { month: 'short' }), year: d.getFullYear(), month: d.getMonth() };
  });
  const revenueMonthly = months.map(({ name, year, month }) => {
    const monthlyRevenue = consultations
      .filter(c => c.date && new Date(c.date).getFullYear() === year && new Date(c.date).getMonth() === month)
      .reduce((s, c) => s + sumItems(c.prescriptions) + sumItems(c.procedures), 0);
    return { name: `${name} ${String(year).slice(2)}`, value: Number(monthlyRevenue.toFixed(2)) };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Insights and statistics from your data</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPatients}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Consultations (This Month)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{consultationsThisMonth}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Average Wait Time</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgWait} min</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revenue (This Month)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${revenueThisMonth.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">All-time: ${revenueAllTime.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <AnalyticsCharts
        genderData={genderData}
        ageData={ageData}
        weeklyVisits={weeklyVisits}
        diagnosisTop={diagnosisTop}
        revenueMonthly={revenueMonthly}
      />
    </div>
  );
}
