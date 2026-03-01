'use client';

import { useEffect, useState } from 'react';
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

interface ChainAsset {
  chain: string;
  symbol: string;
  value_usd: number;
}

const COLORS = [
  '#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#14b8a6', '#6366f1', '#84cc16', '#a855f7',
];

export default function ChainDistributionChart() {
  const [assets, setAssets] = useState<ChainAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChainData();
    // 按需获取，不轮询
    // return () => {};
  }, []);

  const fetchChainData = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/chain');
      if (res.ok) {
        const data = await res.json();
        setAssets(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch chain data:', err);
    } finally {
      setLoading(false);
    }
  };

  // 按链聚合
  const chainTotals = assets.reduce((acc, asset) => {
    if (!acc[asset.chain]) {
      acc[asset.chain] = 0;
    }
    acc[asset.chain] += asset.value_usd;
    return acc;
  }, {} as Record<string, number>);

  const labels = Object.keys(chainTotals);
  const values = Object.values(chainTotals);

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
            const percentage = ((value / total) * 100).toFixed(1);
            return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${percentage}%)`;
          },
        },
      },
    },
  };

  if (loading) {
    return (
      <div className="h-56 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center">
        <div className="text-gray-500 text-sm">No chain data</div>
      </div>
    );
  }

  return (
    <div className="h-56">
      <Pie data={chartData} options={options} />
    </div>
  );
}
