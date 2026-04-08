"use client";

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface CandlestickChartProps {
  symbol: string;
  priceData: {
    dates: string[];
    price: number[];
    sma50: number[];
    sma200: number[];
  };
}

export default function CandlestickChart({
  symbol,
  priceData,
}: CandlestickChartProps) {
  // Transform data
  const dataLength = priceData.dates.length;
  // Take only last 90 data points
  const itemsToTake = Math.min(90, dataLength);
  const startIndex = dataLength - itemsToTake;

  const data = Array.from({ length: itemsToTake }, (_, i) => {
    const idx = startIndex + i;
    return {
      date: priceData.dates[idx],
      price: priceData.price[idx],
      sma50: priceData.sma50[idx],
      sma200: priceData.sma200[idx],
    };
  });

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
        >
          <CartesianGrid stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value, index) => {
              if (index % 15 !== 0) return "";
              const date = new Date(value);
              return date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });
            }}
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={["auto", "auto"]}
            tickFormatter={(val) => `₹${val}`}
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f172a",
              borderColor: "#1e293b",
              borderRadius: "0.5rem",
              color: "#f8fafc",
            }}
            itemStyle={{ color: "#f8fafc" }}
            formatter={(value: number, name: string) => [
              value.toFixed(2),
              name,
            ]}
            labelStyle={{ color: "#94a3b8", marginBottom: "0.25rem" }}
          />
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
          <Line
            type="monotone"
            dataKey="price"
            name="Price"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="sma50"
            name="SMA 50"
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="sma200"
            name="SMA 200"
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
