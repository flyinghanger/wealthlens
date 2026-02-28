export type SnapshotDataPart = 'stocks' | 'cash' | 'funds' | 'crypto' | 'chain';
export type SnapshotDataPartState = 'realtime' | 'fallback' | 'missing';

export interface SnapshotDataPartStatus {
  state: SnapshotDataPartState;
  note: string;
}

export type SnapshotDataSourceStatus = Record<SnapshotDataPart, SnapshotDataPartStatus>;

export interface SnapshotDataIntegrity {
  used_historical_data: boolean;
  used_historical_data_parts: SnapshotDataPart[];
  sources: SnapshotDataSourceStatus;
  warnings: string[];
}

export interface PreviousSnapshotForFallback {
  stocksValue?: number;
  cashValue?: number;
  fundAssetsValue?: number;
  stocksPositions?: any[];
  cryptoPositions?: any[];
  chainAssets?: any[];
}

export interface SnapshotRealtimeInput {
  stocksValue?: number;
  cashValue?: number;
  fundAssetsValue?: number;
  stocksPositions?: any[];
  cryptoPositions?: any[];
  chainAssets?: any[];
  available: Record<SnapshotDataPart, boolean>;
  missingReasons?: Partial<Record<SnapshotDataPart, string>>;
}

export interface SnapshotMergedResult {
  stocksValue: number;
  cashValue: number;
  fundAssetsValue: number;
  stocksPositions: any[];
  cryptoPositions: any[];
  chainAssets: any[];
  cryptoValue: number;
  chainValue: number;
  dataIntegrity: SnapshotDataIntegrity;
}

const PARTS: SnapshotDataPart[] = ['stocks', 'cash', 'funds', 'crypto', 'chain'];

const toFiniteNumber = (value: unknown): number => {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
};

const toArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);

const sumUsdValue = (positions: any[]): number =>
  positions.reduce((sum, item) => sum + toFiniteNumber(item?.value_usd), 0);

const sourceReason = (
  part: SnapshotDataPart,
  reasons?: Partial<Record<SnapshotDataPart, string>>,
): string => reasons?.[part] || '实时数据缺失';

const emptyStatuses = (): SnapshotDataSourceStatus => ({
  stocks: { state: 'realtime', note: '使用实时数据' },
  cash: { state: 'realtime', note: '使用实时数据' },
  funds: { state: 'realtime', note: '使用实时数据' },
  crypto: { state: 'realtime', note: '使用实时数据' },
  chain: { state: 'realtime', note: '使用实时数据' },
});

export function mergeSnapshotWithFallback(input: {
  realtime: SnapshotRealtimeInput;
  previousSnapshot?: PreviousSnapshotForFallback | null;
}): SnapshotMergedResult {
  const previous = input.previousSnapshot || null;
  const realtime = input.realtime;

  let stocksValue = toFiniteNumber(realtime.stocksValue);
  let cashValue = toFiniteNumber(realtime.cashValue);
  let fundAssetsValue = toFiniteNumber(realtime.fundAssetsValue);
  let stocksPositions = toArray(realtime.stocksPositions);
  let cryptoPositions = toArray(realtime.cryptoPositions);
  let chainAssets = toArray(realtime.chainAssets);

  const statuses = emptyStatuses();
  const warnings: string[] = [];
  const usedHistoricalParts: SnapshotDataPart[] = [];

  const fallbackPositionsStocks = toArray(previous?.stocksPositions);
  const fallbackPositionsCrypto = toArray(previous?.cryptoPositions);
  const fallbackPositionsChain = toArray(previous?.chainAssets);

  for (const part of PARTS) {
    if (realtime.available[part]) {
      statuses[part] = { state: 'realtime', note: '使用实时数据' };
      continue;
    }

    const reason = sourceReason(part, realtime.missingReasons);

    if (!previous) {
      statuses[part] = {
        state: 'missing',
        note: `实时和历史数据都不可用: ${reason}`,
      };
      warnings.push(`${part} 数据缺失且无历史快照可回退 (${reason})`);
      continue;
    }

    switch (part) {
      case 'stocks':
        stocksValue = toFiniteNumber(previous.stocksValue);
        stocksPositions = fallbackPositionsStocks;
        break;
      case 'cash':
        cashValue = toFiniteNumber(previous.cashValue);
        break;
      case 'funds':
        fundAssetsValue = toFiniteNumber(previous.fundAssetsValue);
        break;
      case 'crypto':
        cryptoPositions = fallbackPositionsCrypto;
        break;
      case 'chain':
        chainAssets = fallbackPositionsChain;
        break;
    }

    statuses[part] = {
      state: 'fallback',
      note: `使用历史快照数据: ${reason}`,
    };
    warnings.push(`${part} 使用历史快照 fallback (${reason})`);
    usedHistoricalParts.push(part);
  }

  return {
    stocksValue,
    cashValue,
    fundAssetsValue,
    stocksPositions,
    cryptoPositions,
    chainAssets,
    cryptoValue: sumUsdValue(cryptoPositions),
    chainValue: sumUsdValue(chainAssets),
    dataIntegrity: {
      used_historical_data: usedHistoricalParts.length > 0,
      used_historical_data_parts: usedHistoricalParts,
      sources: statuses,
      warnings,
    },
  };
}
