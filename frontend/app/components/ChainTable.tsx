'use client';

import { useMemo, useState } from 'react';

type SortDirection = 'asc' | 'desc';
type ChainSortKey = 'chain' | 'symbol' | 'balance' | 'value_usd' | 'address';

interface ChainAsset {
  chain: string;
  symbol: string;
  balance?: number;
  value_usd: number;
  address?: string;
}

interface ChainTableProps {
  assets: ChainAsset[];
  formatUsd: (value: number) => string;
}

const shortenAddress = (address?: string) => {
  if (!address) {
    return '-';
  }
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export default function ChainTable({ assets, formatUsd }: ChainTableProps) {
  const [sortConfig, setSortConfig] = useState<{ key: ChainSortKey; direction: SortDirection } | null>({
    key: 'value_usd',
    direction: 'desc',
  });

  const sortedAssets = useMemo(() => {
    const list = [...assets];
    if (!sortConfig) {
      return list;
    }

    const direction = sortConfig.direction === 'asc' ? 1 : -1;

    return list.sort((left, right) => {
      if (sortConfig.key === 'chain' || sortConfig.key === 'symbol' || sortConfig.key === 'address') {
        const l = String(left[sortConfig.key] || '').toLowerCase();
        const r = String(right[sortConfig.key] || '').toLowerCase();
        return l.localeCompare(r) * direction;
      }

      const l = Number(left[sortConfig.key] || 0);
      const r = Number(right[sortConfig.key] || 0);
      return (l - r) * direction;
    });
  }, [assets, sortConfig]);

  const handleSort = (key: ChainSortKey) => {
    setSortConfig((current) => {
      if (current?.key === key) {
        return { key, direction: current.direction === 'desc' ? 'asc' : 'desc' };
      }
      return { key, direction: 'desc' };
    });
  };

  const getSortArrow = (key: ChainSortKey) => {
    if (sortConfig?.key !== key) {
      return '↕';
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  if (assets.length === 0) {
    return null;
  }

  return (
    <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
      <div className="border-b border-gray-800 px-6 py-4 font-semibold text-gray-200">Chain Assets</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-800/50 text-xs text-gray-500">
            <tr>
              <th className="py-2 px-4 text-left cursor-pointer hover:text-white" onClick={() => handleSort('chain')}>
                Chain {getSortArrow('chain')}
              </th>
              <th className="py-2 px-4 text-left cursor-pointer hover:text-white" onClick={() => handleSort('symbol')}>
                Asset {getSortArrow('symbol')}
              </th>
              <th className="py-2 px-4 text-right cursor-pointer hover:text-white" onClick={() => handleSort('balance')}>
                Balance {getSortArrow('balance')}
              </th>
              <th className="py-2 px-4 text-right cursor-pointer hover:text-white" onClick={() => handleSort('value_usd')}>
                Value ($) {getSortArrow('value_usd')}
              </th>
              <th className="py-2 px-4 text-right cursor-pointer hover:text-white" onClick={() => handleSort('address')}>
                Wallet {getSortArrow('address')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedAssets.map((asset: ChainAsset, idx: number) => (
              <tr
                key={`${asset.chain}-${asset.symbol}-${asset.address || 'no-wallet'}-${idx}`}
                className="border-b border-gray-800/50 hover:bg-gray-800/50"
              >
                <td className="py-3 px-4 text-gray-300">{asset.chain}</td>
                <td className="py-3 px-4 font-bold text-gray-200">{asset.symbol}</td>
                <td className="py-3 px-4 text-right font-mono text-gray-400">{Number(asset.balance || 0).toFixed(4)}</td>
                <td className="py-3 px-4 text-right font-mono font-bold text-white">
                  {formatUsd(Number(asset.value_usd || 0))}
                </td>
                <td className="py-3 px-4 text-right font-mono text-gray-500">{shortenAddress(asset.address)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
