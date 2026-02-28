'use client';

type SortDirection = 'asc' | 'desc';
type CryptoSortKey = 'source' | 'symbol' | 'amount' | 'price' | 'value_usd';

interface CryptoPosition {
  symbol: string;
  amount: number;
  price?: number;
  value_usd: number;
  exchange: string;
  account?: string;
}

interface CryptoTableProps {
  positions: CryptoPosition[];
  sortConfig: { key: CryptoSortKey; direction: SortDirection } | null;
  onSort: (key: CryptoSortKey) => void;
  getSortArrow: (direction?: SortDirection) => string;
  getSourceBadgeClass: (exchange: string) => string;
  formatUsd: (value: number) => string;
}

export default function CryptoTable({
  positions,
  sortConfig,
  onSort,
  getSortArrow,
  getSourceBadgeClass,
  formatUsd,
}: CryptoTableProps) {
  if (positions.length === 0) {
    return null;
  }

  return (
    <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
      <div className="border-b border-gray-800 px-6 py-4 font-semibold text-gray-200">Crypto Assets (Risk)</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-800/50 text-xs text-gray-500">
            <tr>
              <th className="py-2 px-4 text-left cursor-pointer hover:text-white" onClick={() => onSort('source')}>
                Source {sortConfig?.key === 'source' ? getSortArrow(sortConfig.direction) : '↕'}
              </th>
              <th className="py-2 px-4 text-left cursor-pointer hover:text-white" onClick={() => onSort('symbol')}>
                Asset {sortConfig?.key === 'symbol' ? getSortArrow(sortConfig.direction) : '↕'}
              </th>
              <th className="py-2 px-4 text-right cursor-pointer hover:text-white" onClick={() => onSort('amount')}>
                Qty {sortConfig?.key === 'amount' ? getSortArrow(sortConfig.direction) : '↕'}
              </th>
              <th className="py-2 px-4 text-right cursor-pointer hover:text-white" onClick={() => onSort('price')}>
                Price ($) {sortConfig?.key === 'price' ? getSortArrow(sortConfig.direction) : '↕'}
              </th>
              <th className="py-2 px-4 text-right cursor-pointer hover:text-white" onClick={() => onSort('value_usd')}>
                Value ($) {sortConfig?.key === 'value_usd' ? getSortArrow(sortConfig.direction) : '↕'}
              </th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position: CryptoPosition, idx: number) => (
              <tr
                key={`${position.exchange}-${position.symbol}-${idx}`}
                className="border-b border-gray-800/50 hover:bg-gray-800/50"
              >
                <td className="py-3 px-4 text-gray-400">
                  <span className={`text-xs px-2 py-1 rounded ${getSourceBadgeClass(position.exchange)}`}>
                    {position.account ? `${position.exchange} (${position.account})` : position.exchange}
                  </span>
                </td>
                <td className="py-3 px-4 font-bold text-gray-200">{position.symbol}</td>
                <td className="py-3 px-4 text-right font-mono text-gray-400">{position.amount.toFixed(4)}</td>
                <td className="py-3 px-4 text-right font-mono text-gray-400">{formatUsd(position.price || 0)}</td>
                <td className="py-3 px-4 text-right font-mono font-bold text-white">
                  ${position.value_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
