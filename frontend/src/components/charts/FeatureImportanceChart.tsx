"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";

interface FeatureImportanceChartProps {
  importances: Array<{
    feature_name: string;
    importance: number;
    category: string;
  }>;
}

const CATEGORY_COLORS: Record<string, string> = {
  momentum: "#6366f1", // indigo
  volatility: "#f59e0b", // amber
  volume: "#10b981", // emerald
  calendar: "#ec4899", // pink
  technical: "#3b82f6", // blue
};

export default function FeatureImportanceChart({
  importances,
}: FeatureImportanceChartProps) {
  // Sort by importance descending and take top 10
  const sortedData = [...importances]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 10)
    .map((item) => ({
      ...item,
      cleanName: item.feature_name.replace(/_/g, " "),
      displayImp: item.importance * 100,
    }));

  return (
    <div className="w-full h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={sortedData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid stroke="#1e293b" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(val) => `${val}%`}
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="cleanName"
            stroke="#64748b"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={120}
          />
          <Tooltip
            cursor={{ fill: "#1e293b" }}
            contentStyle={{
              backgroundColor: "#0f172a",
              borderColor: "#1e293b",
              borderRadius: "0.5rem",
              color: "#f8fafc",
            }}
            formatter={(value: number, name: string, props: { payload: { category: string } }) => [
              `${value.toFixed(1)}%`,
              `Importance (${props.payload.category})`,
            ]}
          />
          <Bar
            dataKey="displayImp"
            radius={[0, 4, 4, 0]}
            label={{ position: "right", fill: "#94a3b8", fontSize: 10, formatter: (val: number) => `${val.toFixed(1)}%` }}
          >
            {sortedData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={CATEGORY_COLORS[entry.category] || "#64748b"}
              />
            ))}
          </Bar>
          {/* Custom legend payload to show categories */}
          <Legend
            payload={Object.keys(CATEGORY_COLORS).map((cat) => ({
              id: cat,
              type: "square",
              value: cat,
              color: CATEGORY_COLORS[cat],
            }))}
            wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
