"use client";

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions,
} from "chart.js";
import { Pie } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

interface CurrencySplitChartProps {
  usdAssetsCny: number;
  cnyAssetsCny: number;
}

export default function CurrencySplitChart({
  usdAssetsCny,
  cnyAssetsCny,
}: CurrencySplitChartProps) {
  const labels = ["USD Assets", "CNY Assets"];
  const values = [usdAssetsCny, cnyAssetsCny];
  const total = values.reduce((sum, value) => sum + value, 0);

  const chartData: ChartData<"pie"> = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: ["#10b981", "#f97316"],
        borderColor: "#1f2937",
        borderWidth: 2,
        hoverOffset: 8,
      },
    ],
  };

  const options: ChartOptions<"pie"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right",
        labels: {
          color: "#9ca3af",
          padding: 16,
          usePointStyle: true,
          pointStyle: "circle",
          font: {
            size: 13,
          },
        },
      },
      tooltip: {
        backgroundColor: "#1f2937",
        titleColor: "#f3f4f6",
        bodyColor: "#d1d5db",
        borderColor: "#374151",
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context) => {
            const value = context.raw as number;
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
            return `¥${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${percentage}%)`;
          },
        },
      },
    },
  };

  if (total <= 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="text-gray-500">No data available</div>
      </div>
    );
  }

  return (
    <div className="h-64">
      <Pie data={chartData} options={options} />
    </div>
  );
}
