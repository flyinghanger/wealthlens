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

interface CryptoPosition {
  symbol: string;
  value_usd: number;
}

interface CryptoDistributionChartProps {
  positions?: CryptoPosition[];
}

const STABLE_SYMBOLS = new Set(['USDT', 'USDC', 'USD1', 'DAI', 'FDUSD', 'USDE']);

const COLORS = [
  '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
  '#6366f1', '#84cc16', '#06b6d4', '#a855f7', '#eab308',
];

export default function CryptoDistributionChart({ positions = [] }: CryptoDistributionChartProps) {
  const riskPositions = positions.filter(
    (position) => !STABLE_SYMBOLS.has(String(position.symbol).toUpperCase()),
  );

  const sorted = [...riskPositions].sort((a, b) => b.value_usd - a.value_usd);
  const topPositions = sorted.slice(0, 6);
  const othersValue = sorted.slice(6).reduce((sum, p) => sum + p.value_usd, 0);

  const labels = [
    ...topPositions.map((p) => p.symbol),
    ...(othersValue > 0 ? ['Others'] : []),
  ];

  const values = [
    ...topPositions.map((p) => p.value_usd),
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
            return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${percentage}%)`;
          },
        },
      },
    },
  };

  if (riskPositions.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center">
        <div className="text-gray-500 text-sm">No risk crypto data</div>
      </div>
    );
  }

  return (
    <div className="h-56">
      <Pie data={chartData} options={options} />
    </div>
  );
}
