'use client';

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions,
} from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

interface StockPosition {
  code: string;
  stock_name: string;
  market_val: number;
  market_val_usd?: number;
}

interface StockDistributionChartProps {
  positions?: StockPosition[];
}

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#06b6d4', '#a855f7', '#eab308', '#22c55e', '#0ea5e9',
];

export default function StockDistributionChart({ positions = [] }: StockDistributionChartProps) {
  const sorted = [...positions].sort(
    (a, b) => (b.market_val_usd ?? b.market_val) - (a.market_val_usd ?? a.market_val),
  );

  const topPositions = sorted.slice(0, 6);
  const othersValue = sorted
    .slice(6)
    .reduce((sum, p) => sum + (p.market_val_usd ?? p.market_val), 0);

  const labels = [
    ...topPositions.map((p) => p.code.replace('US.', '')),
    ...(othersValue > 0 ? ['Others'] : []),
  ];

  const values = [
    ...topPositions.map((p) => p.market_val_usd ?? p.market_val),
    ...(othersValue > 0 ? [othersValue] : []),
  ];

  const chartData: ChartData<'pie'> = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: COLORS,
        borderColor: '#1f2937',
        borderWidth: 2,
        hoverOffset: 8,
      },
    ],
  };

  const options: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#9ca3af',
          padding: 12,
          usePointStyle: true,
          pointStyle: 'circle',
          font: { size: 11 },
        },
      },
      tooltip: {
        backgroundColor: '#1f2937',
        titleColor: '#f3f4f6',
        bodyColor: '#d1d5db',
        borderColor: '#374151',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context) => {
            const value = context.raw as number;
            const total = values.reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
            return `$${value.toLocaleString()} (${percentage}%)`;
          },
        },
      },
    },
  };

  if (positions.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center">
        <div className="text-gray-500 text-sm">No stock data</div>
      </div>
    );
  }

  return (
    <div className="h-56">
      <Pie data={chartData} options={options} />
    </div>
  );
}
