'use client';

import { useEffect, useState } from 'react';

interface AssetSnapshot {
  timestamp: number;
  date: string;
  stocks: {
    positions: Array<{
      code: string;
      stock_name: string;
      qty: number;
      market_val: number;
      pl_val: number;
      pl_ratio: number;
    }>;
    totalValue: number;
  };
  funds: {
    cash: number;
    fundAssets: number;
  };
  total: number;
}

export default function DashboardPage() {
  const [snapshot, setSnapshot] = useState<AssetSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSnapshot();
    // 每30秒刷新一次
    const interval = setInterval(fetchSnapshot, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchSnapshot = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/assets/snapshot');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setSnapshot(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="text-red-400">
          Error: {error}
          <br />
          <span className="text-sm text-gray-500">
            请确保后端服务已启动（Port 3001）
          </span>
        </div>
      </div>
    );
  }

  if (!snapshot) return null;

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Wealth Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500 mr-2"></span>
              {new Date(snapshot.timestamp).toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Total Net Worth
            </div>
            <div className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              ${snapshot.total.toLocaleString()}
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <div className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Stocks
            </div>
            <div className="mt-2 text-2xl font-bold text-blue-400">
              ${snapshot.stocks.totalValue.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-gray-600">
              {snapshot.stocks.positions.length} positions
            </div>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <div className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Cash
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-400">
              ${snapshot.funds.cash.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-gray-600">
              Available balance
            </div>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <div className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Fund Assets
            </div>
            <div className="mt-2 text-2xl font-bold text-purple-400">
              ${snapshot.funds.fundAssets.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-gray-600">
              Managed funds
            </div>
          </div>
        </div>

        {/* Stocks Table */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
          <div className="border-b border-gray-800 px-6 py-4 font-semibold text-gray-200">
            Stock Positions
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="py-3 px-4 text-left">Code</th>
                  <th className="py-3 px-4 text-left">Name</th>
                  <th className="py-3 px-4 text-right">Qty</th>
                  <th className="py-3 px-4 text-right">Value</th>
                  <th className="py-3 px-4 text-right">P/L</th>
                  <th className="py-3 px-4 text-right">P/L %</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.stocks.positions.map((position) => (
                  <tr
                    key={position.code}
                    className="border-b border-gray-800/50 transition hover:bg-gray-800/50"
                  >
                    <td className="py-3 px-4 font-mono text-blue-300">
                      {position.code}
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      {position.stock_name}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-gray-400">
                      {position.qty}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white">
                      ${position.market_val.toLocaleString()}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono ${
                        position.pl_val >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      ${position.pl_val.toLocaleString()}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono ${
                        position.pl_ratio >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {position.pl_ratio.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
