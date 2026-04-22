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
type TooltipPayloadEntry = { value?: number | string };
type CustomTooltipProps = { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string };

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4"]; // primary, green, amber, red, violet, cyan

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-md border bg-white px-2.5 py-1.5 shadow-sm">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-gray-900">{item.value}</div>
    </div>
  );
}

interface AnalyticsChartsProps {
  genderData: NameValue[];
  ageData: NameValue[];
  weeklyVisits: Point[];
  diagnosisTop: NameValue[];
  revenueMonthly?: Point[];
}

export default function AnalyticsCharts({ genderData, ageData, weeklyVisits, diagnosisTop, revenueMonthly = [] }: AnalyticsChartsProps) {
  const gridColor = "#e5e7eb"; // neutral-200
  const axisTick = { fontSize: 12, fill: "#6b7280" }; // neutral-500

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="h-[280px] rounded-xl border p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold">Gender Distribution</h3>
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
      </div>

      <div className="h-[280px] rounded-xl border p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold">Age Buckets</h3>
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
      </div>

      <div className="h-[280px] rounded-xl border p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold">Weekly Visits</h3>
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
      </div>

      <div className="h-[280px] rounded-xl border p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold">Top Diagnoses</h3>
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
              <LabelList dataKey="value" position="right" className="text-xs fill-gray-700" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="h-[300px] rounded-xl border p-4 shadow-sm md:col-span-2">
        <h3 className="mb-3 text-sm font-semibold">Revenue (Last 12 Months)</h3>
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
      </div>
    </div>
  );
}

