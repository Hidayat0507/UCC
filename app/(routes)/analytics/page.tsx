export const dynamic = 'force-dynamic';

import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Users, Calendar, TrendingUp } from "lucide-react";
import { getPatients, getConsultationsByPatientId } from "@/lib/models";
import AnalyticsCharts from "@/components/analytics/analytics-charts";

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
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
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
    <div className="space-y-6 pb-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Clinic performance, patient mix, visit trends, and revenue movement.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AnalyticsMetricCard
          icon={<Users className="h-4 w-4 text-sky-700" />}
          label="Total patients"
          value={totalPatients.toString()}
          hint="Active patient records"
        />
        <AnalyticsMetricCard
          icon={<Activity className="h-4 w-4 text-emerald-700" />}
          label="Consultations"
          value={consultationsThisMonth.toString()}
          hint="This month"
        />
        <AnalyticsMetricCard
          icon={<Calendar className="h-4 w-4 text-amber-700" />}
          label="Average wait"
          value={`${avgWait} min`}
          hint={`${waitTimes.length} completed queue samples`}
        />
        <AnalyticsMetricCard
          icon={<TrendingUp className="h-4 w-4 text-violet-700" />}
          label="Revenue"
          value={`RM ${revenueThisMonth.toFixed(2)}`}
          hint={`All-time RM ${revenueAllTime.toFixed(2)}`}
        />
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

function AnalyticsMetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardContent className="flex items-center justify-between p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
