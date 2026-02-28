'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartData,
  ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

interface TrendData {
  period: string;
  snapshots: Array<{
    timestamp: number;
    total: number;
    stocks: number;
    cryptoRisk: number;
    usdSavings: number;
    cnyAssets: number;
  }>;
}

type TrendMode = 'percentage' | 'absolute';
type TrendMetricKey = 'total' | 'stocks' | 'cryptoRisk' | 'usdSavings' | 'cnyAssets';

const METRICS: Array<{
  key: TrendMetricKey;
  label: string;
  borderColor: string;
  backgroundColor: string;
  fill: boolean;
  borderDash?: number[];
}> = [
  {
    key: 'total',
    label: 'Total',
    borderColor: '#e5e7eb',
    backgroundColor: 'transparent',
    fill: false,
    borderDash: [6, 4],
  },
  {
    key: 'stocks',
    label: 'Stocks',
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    fill: true,
  },
  {
    key: 'cryptoRisk',
    label: 'Crypto (Risk)',
    borderColor: '#eab308',
    backgroundColor: 'transparent',
    fill: false,
  },
  {
    key: 'usdSavings',
    label: 'USD Savings',
    borderColor: '#10b981',
    backgroundColor: 'transparent',
    fill: false,
  },
  {
    key: 'cnyAssets',
    label: 'CNY Assets',
    borderColor: '#f97316',
    backgroundColor: 'transparent',
    fill: false,
  },
];

const ZERO_BASELINE_LABEL = '0% Baseline';

const formatCurrency = (value: number, withDecimals = false) =>
  `$${value.toLocaleString(undefined, {
    minimumFractionDigits: withDecimals ? 2 : 0,
    maximumFractionDigits: withDecimals ? 2 : 0,
  })}`;

const formatSignedCurrency = (value: number) =>
  `${value >= 0 ? '+' : '-'}$${Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatSignedPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

export default function TrendChart() {
  const [data, setData] = useState<TrendData | null>(null);
  const [period, setPeriod] = useState(7);
  const [mode, setMode] = useState<TrendMode>('percentage');
  const [loading, setLoading] = useState(true);

  const fetchTrend = async (targetPeriod: number) => {
    try {
      const res = await fetch(`http://localhost:3001/api/history/trend?days=${targetPeriod}`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error('Failed to fetch trend:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrend(period);
  }, [period]);

  const snapshots = useMemo(() => data?.snapshots ?? [], [data]);
  const labels = useMemo(
    () =>
      snapshots.map((snapshot) => {
        const date = new Date(snapshot.timestamp);
        if (period === 1) {
          return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
      }),
    [snapshots, period],
  );

  const chartData: ChartData<'line'> = useMemo(() => {
    const datasets = METRICS.map((metric) => {
      const initial = Number(snapshots[0]?.[metric.key] || 0);
      const series = snapshots.map((snapshot) => {
        const current = Number(snapshot[metric.key] || 0);
        if (mode === 'absolute') {
          return current;
        }
        if (initial === 0) {
          return 0;
        }
        return ((current - initial) / initial) * 100;
      });

      return {
        label: metric.label,
        data: series,
        borderColor: metric.borderColor,
        backgroundColor: metric.backgroundColor,
        borderWidth: 2,
        borderDash: metric.borderDash,
        fill: metric.fill,
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 5,
      };
    });

    if (mode === 'percentage' && labels.length > 0) {
      datasets.push({
        label: ZERO_BASELINE_LABEL,
        data: labels.map(() => 0),
        borderColor: '#6b7280',
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderDash: [4, 4],
        fill: false,
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
      });
    }

    return {
      labels,
      datasets,
    };
  }, [labels, mode, snapshots]);

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          filter: (legendItem) => legendItem.text !== ZERO_BASELINE_LABEL,
          color: '#9ca3af',
          padding: 16,
          usePointStyle: true,
          pointStyle: 'line',
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: '#1f2937',
        titleColor: '#f3f4f6',
        bodyColor: '#d1d5db',
        borderColor: '#374151',
        borderWidth: 1,
        padding: 12,
        filter: (context) => context.dataset.label !== ZERO_BASELINE_LABEL,
        callbacks: {
          label: (context) => {
            const datasetLabel = context.dataset.label || '';
            if (mode === 'absolute') {
              return `${datasetLabel}: ${formatCurrency(Number(context.raw || 0), true)}`;
            }

            const metric = METRICS.find((item) => item.label === datasetLabel);
            if (!metric || !snapshots.length) {
              return `${datasetLabel}: ${formatSignedPercent(Number(context.raw || 0))}`;
            }

            const index = context.dataIndex;
            const current = Number(snapshots[index]?.[metric.key] || 0);
            const initial = Number(snapshots[0]?.[metric.key] || 0);
            const delta = current - initial;
            return `${datasetLabel}: ${formatSignedPercent(Number(context.raw || 0))} (${formatSignedCurrency(delta)})`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: '#374151',
        },
        ticks: {
          color: '#9ca3af',
          maxRotation: 0,
        },
      },
      y: {
        grid: {
          color: (ctx) => {
            if (mode === 'percentage' && Number(ctx.tick.value) === 0) {
              return '#9ca3af';
            }
            return '#374151';
          },
          lineWidth: (ctx) => {
            if (mode === 'percentage' && Number(ctx.tick.value) === 0) {
              return 1.25;
            }
            return 1;
          },
        },
        ticks: {
          color: '#9ca3af',
          callback: (value) =>
            mode === 'percentage' ? `${Number(value).toFixed(0)}%` : formatCurrency(Number(value)),
        },
      },
    },
  };

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {[1, 7, 30].map((days) => (
          <button
            key={days}
            onClick={() => {
              setPeriod(days);
              setLoading(true);
            }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              period === days
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {days === 1 ? '今日' : `${days}天`}
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setMode('percentage')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
            mode === 'percentage'
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          百分比
        </button>
        <button
          onClick={() => setMode('absolute')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
            mode === 'absolute'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          绝对金额
        </button>
      </div>

      <div className="h-80">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-gray-500">Loading chart...</div>
          </div>
        ) : data && data.snapshots.length > 0 ? (
          <Line data={chartData} options={options} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-gray-500">No historical data yet</div>
          </div>
        )}
      </div>
    </div>
  );
}
