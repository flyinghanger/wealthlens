const STABLE_SYMBOLS = new Set(['USDT', 'USDC', 'USD1', 'DAI', 'FDUSD', 'USDE']);

export const DEFAULT_DOMESTIC_USD = 12687;
export const DEFAULT_DOMESTIC_FUNDS_CNY = 40000;

export interface SnapshotBucketInput {
  stocksValue: number;
  cashValue: number;
  fundAssetsValue: number;
  cryptoPositions?: Array<{ symbol?: string; value_usd?: number }>;
  chainAssets?: Array<{ symbol?: string; value_usd?: number }>;
  feishuData?: {
    usd_savings?: number;
    funds_cny?: number;
    balance_cny?: number;
    provident_fund_cny?: number;
    debt_cny?: number;
  } | null;
  usdToCny?: number;
  domesticUsd?: number;
  domesticFundsCny?: number;
}

export interface SnapshotBucketResult {
  stocksBucketUsd: number;
  cryptoRiskBucketUsd: number;
  usdSavingsBucketUsd: number;
  cnyAssetsBucketUsd: number;
  stablecoinTotalUsd: number;
  cnyAssetsTotalCny: number;
  totalValue: number;
}

const toNumber = (value: unknown): number => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
};

export function calculateSnapshotBuckets(input: SnapshotBucketInput): SnapshotBucketResult {
  const domesticUsdFromFeishu = input.feishuData?.usd_savings;
  const domesticUsd =
    input.domesticUsd !== undefined
      ? toNumber(input.domesticUsd)
      : domesticUsdFromFeishu !== undefined
        ? toNumber(domesticUsdFromFeishu)
        : DEFAULT_DOMESTIC_USD;
  const domesticFundsCny =
    input.domesticFundsCny === undefined
      ? DEFAULT_DOMESTIC_FUNDS_CNY
      : toNumber(input.domesticFundsCny);

  const stocksValue = toNumber(input.stocksValue);
  const cashValue = toNumber(input.cashValue);
  const fundAssetsValue = toNumber(input.fundAssetsValue);

  const allCrypto = [...(input.cryptoPositions || []), ...(input.chainAssets || [])];

  let stablecoinTotalUsd = 0;
  let cryptoRiskBucketUsd = 0;

  for (const position of allCrypto) {
    const symbol = String(position.symbol || '').toUpperCase();
    const valueUsd = toNumber(position.value_usd);

    if (STABLE_SYMBOLS.has(symbol)) {
      stablecoinTotalUsd += valueUsd;
    } else {
      cryptoRiskBucketUsd += valueUsd;
    }
  }

  const stocksBucketUsd = stocksValue + cashValue;
  const usdSavingsBucketUsd = domesticUsd + fundAssetsValue + stablecoinTotalUsd;

  const feishuFunds = toNumber(input.feishuData?.funds_cny);
  const balanceCny = toNumber(input.feishuData?.balance_cny);
  const providentCny = toNumber(input.feishuData?.provident_fund_cny);
  const debtCny = toNumber(input.feishuData?.debt_cny);

  const domesticFundsCnyValue = feishuFunds > 0 ? feishuFunds : domesticFundsCny;
  const cnyAssetsTotalCny = domesticFundsCnyValue + balanceCny + providentCny + debtCny;

  const usdToCny = toNumber(input.usdToCny);
  const cnyAssetsBucketUsd = usdToCny > 0 ? cnyAssetsTotalCny / usdToCny : 0;

  const totalValue = stocksBucketUsd + cryptoRiskBucketUsd + usdSavingsBucketUsd + cnyAssetsBucketUsd;

  return {
    stocksBucketUsd,
    cryptoRiskBucketUsd,
    usdSavingsBucketUsd,
    cnyAssetsBucketUsd,
    stablecoinTotalUsd,
    cnyAssetsTotalCny,
    totalValue,
  };
}
