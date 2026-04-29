"use client";

import {
  ResponsiveContainer,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LabelList,
} from "recharts";

type NameValue = { name: string; value: number };
type Point = { name: string; value: number };

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4"]; // primary, green, amber, red, violet, cyan

interface AnalyticsChartsProps {
  genderData: NameValue[];
  ageData: NameValue[];
  weeklyVisits: Point[];
  diagnosisTop: NameValue[];
  revenueMonthly?: Point[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-950">{item.value}</div>
    </div>
  );
}

export default function AnalyticsCharts({ genderData, ageData, weeklyVisits, diagnosisTop, revenueMonthly = [] }: AnalyticsChartsProps) {
  const gridColor = "#e5e7eb"; // neutral-200
  const axisTick = { fontSize: 12, fill: "#6b7280" }; // neutral-500

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ChartPanel title="Gender distribution">
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={genderData} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={90} tick={axisTick} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" name="Count" radius={[0, 8, 8, 0]}>
              {genderData.map((entry, index) => (
                <Cell key={`g-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
              <LabelList dataKey="value" position="right" className="text-xs fill-gray-700" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel title="Age buckets">
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={ageData} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={90} tick={axisTick} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" name="Count" radius={[0, 8, 8, 0]}>
              {ageData.map((entry, index) => (
                <Cell key={`a-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
              <LabelList dataKey="value" position="right" className="text-xs fill-gray-700" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel title="Weekly visits">
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={weeklyVisits} margin={{ left: 8, right: 8 }}>
            <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" fill="#2563eb" radius={[8, 8, 0, 0]}>
              <LabelList dataKey="value" position="top" className="text-xs fill-gray-700" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel title="Top diagnoses">
        {diagnosisTop.length > 0 ? (
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={diagnosisTop} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={120} tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Count" radius={[0, 8, 8, 0]}>
                {diagnosisTop.map((entry, index) => (
                  <Cell key={`d-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
                <LabelList dataKey="value" position="right" className="text-xs fill-slate-700" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState>No diagnoses recorded yet.</EmptyChartState>
        )}
      </ChartPanel>

      <ChartPanel title="Revenue (last 12 months)" className="h-[300px] md:col-span-2">
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={revenueMonthly} margin={{ left: 8, right: 8 }}>
            <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" fill="#16a34a" radius={[8, 8, 0, 0]}>
              <LabelList dataKey="value" position="top" className="text-xs fill-gray-700" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>
    </div>
  );
}

function ChartPanel({
  title,
  className = "h-[280px]",
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ${className}`}>
      <h3 className="mb-3 text-sm font-semibold text-slate-950">{title}</h3>
      {children}
    </div>
  );
}

function EmptyChartState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[88%] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
