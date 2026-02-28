'use client';

import { useEffect, useState, useMemo } from 'react';
import AssetDistributionChart from '../components/AssetDistributionChart';
import CurrencySplitChart from '../components/CurrencySplitChart';
import TrendChart from '../components/TrendChart';
import StockDistributionChart from '../components/StockDistributionChart';
import CryptoDistributionChart from '../components/CryptoDistributionChart';
import FeishuDataPanel from '../components/FeishuDataPanel';
import CryptoTable from '../components/CryptoTable';
import ChainTable from '../components/ChainTable';

type SortDirection = 'asc' | 'desc';
type SourceStatus = 'live' | 'off';
type PanelTab = 'dashboard' | 'feishu';
type FetchSourceKey = 'futu' | 'crypto' | 'chain' | 'feishu' | 'rates';
type FetchSourceState = 'idle' | 'loading' | 'ok' | 'fail';

type StockSortKey =
  | 'code'
  | 'market_val_usd'
  | 'nominal_price'
  | 'pl_val_usd'
  | 'price_change_24h_value';

type CryptoSortKey = 'source' | 'symbol' | 'amount' | 'price' | 'value_usd';

interface SortConfig<K extends string> {
  key: K;
  direction: SortDirection;
}

interface StockPosition {
  code: string;
  stock_name: string;
  qty: number;
  cost_price?: number;
  nominal_price?: number;
  market_val: number;
  market_val_usd?: number;
  pl_val: number;
  pl_val_usd?: number;
  pl_ratio: number;
  price_change_24h_percent?: number;
  price_change_24h_value?: number;
  currency?: string;
}

interface FutuSnapshot {
  stocks?: {
    totalValue?: number;
    positions?: StockPosition[];
  };
  funds?: {
    cash?: number;
    cash_usd?: number;
    fundAssets?: number;
    fund_assets_usd?: number;
  };
}

interface CryptoPosition {
  symbol: string;
  amount: number;
  price?: number;
  value_usd: number;
  exchange: string;
  type?: string;
  account?: string;
}

interface ChainAsset {
  chain: string;
  symbol: string;
  balance?: number;
  value_usd: number;
  address?: string;
}

interface FeishuLatest {
  error?: string;
  usd_savings?: number;
  funds_cny?: number;
  balance_cny?: number;
  provident_fund_cny?: number;
  debt_cny?: number;
}

interface RatesResponse {
  usd_to_cny?: number;
}

interface CryptoHealthResponse {
  ingest?: {
    okx?: {
      source?: 'web' | 'v5' | 'none';
      tokenSource?: 'config' | 'legacy' | 'none';
      lastError?: string;
    };
    binance?: {
      source?: 'api-key' | 'snapshot' | 'none';
      hasCredentials?: boolean;
    };
    updatedAt?: number;
  };
}

interface HistoryLatestResponse {
  error?: string;
  timestamp?: number;
  total?: number;
  buckets?: {
    stocks?: number;
    crypto_risk?: number;
    usd_savings?: number;
    cny_assets?: number;
  };
  stocks?: {
    value?: number;
    positions?: StockPosition[];
  };
  cash?: number;
  funds?: number;
  crypto?: {
    positions?: CryptoPosition[];
  };
  chain?: {
    assets?: ChainAsset[];
  };
  rates_snapshot?: {
    usd_to_cny?: number;
  };
}

const STABLE_SYMBOLS = new Set(['USDT', 'USDC', 'USD1', 'DAI', 'FDUSD', 'USDE']);

export default function DashboardPage() {
  const [futuData, setFutuData] = useState<FutuSnapshot | null>(null);
  const [cryptoData, setCryptoData] = useState<CryptoPosition[]>([]);
  const [chainData, setChainData] = useState<ChainAsset[]>([]);
  const [feishuData, setFeishuData] = useState<FeishuLatest | null>(null);
  const [loading, setLoading] = useState(true);
  const [usdToCny, setUsdToCny] = useState(7.25);
  const [stockSortConfig, setStockSortConfig] = useState<SortConfig<StockSortKey> | null>(null);
  const [cryptoSortConfig, setCryptoSortConfig] = useState<SortConfig<CryptoSortKey> | null>(null);
  const [cryptoHealth, setCryptoHealth] = useState<CryptoHealthResponse | null>(null);
  const [futuStatus, setFutuStatus] = useState<SourceStatus>('off');
  const [activeTab, setActiveTab] = useState<PanelTab>('dashboard');
  const [realtimeLoading, setRealtimeLoading] = useState(false);
  const [usingSnapshotFallback, setUsingSnapshotFallback] = useState(false);
  const [lastRealtimeAt, setLastRealtimeAt] = useState<number | null>(null);
  const [snapshotBuckets, setSnapshotBuckets] = useState<{
    stocksUsd: number;
    cryptoRiskUsd: number;
    usdSavingsUsd: number;
    cnyAssetsUsd: number;
    totalUsd: number;
  } | null>(null);
  const [sourceLoadState, setSourceLoadState] = useState<Record<FetchSourceKey, FetchSourceState>>({
    futu: 'idle',
    crypto: 'idle',
    chain: 'idle',
    feishu: 'idle',
    rates: 'idle',
  });

  const DEFAULT_DOMESTIC_USD = 12687;

  const formatCny = (value: number) =>
    `¥${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const formatUsd = (value: number) =>
    `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getSourceBadgeClass = (exchange: string) => {
    if (exchange.toLowerCase().includes('okx')) {
      return 'bg-blue-900/30 text-blue-300 border border-blue-500/20';
    }
    if (exchange.toLowerCase().includes('binance')) {
      return 'bg-yellow-900/30 text-yellow-300 border border-yellow-500/20';
    }
    if (exchange.toLowerCase().includes('hyperliquid')) {
      return 'bg-purple-900/30 text-purple-300 border border-purple-500/20';
    }
    return 'bg-gray-900/30 text-gray-300 border border-gray-500/20';
  };

  const applyHistorySnapshot = (snapshot: HistoryLatestResponse) => {
    if (!snapshot || snapshot.error) {
      return false;
    }

    setFutuData({
      stocks: {
        totalValue: Number(snapshot.stocks?.value || 0),
        positions: Array.isArray(snapshot.stocks?.positions) ? snapshot.stocks?.positions : [],
      },
      funds: {
        cash_usd: Number(snapshot.cash || 0),
        fund_assets_usd: Number(snapshot.funds || 0),
      },
    });

    setCryptoData(Array.isArray(snapshot.crypto?.positions) ? snapshot.crypto.positions : []);
    setChainData(Array.isArray(snapshot.chain?.assets) ? snapshot.chain.assets : []);

    const snapshotRate = Number(snapshot.rates_snapshot?.usd_to_cny || 0);
    if (snapshotRate > 0) {
      setUsdToCny(snapshotRate);
    }

    const stocksUsd = Number(snapshot.buckets?.stocks || 0);
    const cryptoRiskUsd = Number(snapshot.buckets?.crypto_risk || 0);
    const usdSavingsUsd = Number(snapshot.buckets?.usd_savings || 0);
    const cnyAssetsUsd = Number(snapshot.buckets?.cny_assets || 0);
    const totalUsd = Number(snapshot.total || stocksUsd + cryptoRiskUsd + usdSavingsUsd + cnyAssetsUsd);

    if (totalUsd > 0) {
      setSnapshotBuckets({
        stocksUsd,
        cryptoRiskUsd,
        usdSavingsUsd,
        cnyAssetsUsd,
        totalUsd,
      });
    }

    setUsingSnapshotFallback(true);
    return true;
  };

  const loadLatestSnapshotFallback = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/history/latest');
      if (!res.ok) {
        return false;
      }
      const data: HistoryLatestResponse = await res.json();
      return applyHistorySnapshot(data);
    } catch {
      return false;
    }
  };

  const fetchAllData = async () => {
    setRealtimeLoading(true);
    setSourceLoadState({
      futu: 'loading',
      crypto: 'loading',
      chain: 'loading',
      feishu: 'loading',
      rates: 'loading',
    });
    try {
      const [futuRes, cryptoRes, chainRes, feishuRes, ratesRes, cryptoHealthRes] = await Promise.allSettled([
        fetch('http://localhost:3001/api/assets/snapshot'),
        fetch('http://localhost:3001/api/crypto'),
        fetch('http://localhost:3001/api/chain'),
        fetch('http://localhost:3001/api/feishu/latest'),
        fetch('http://localhost:3001/api/rates'),
        fetch('http://localhost:3001/api/crypto/health'),
      ]);

      let hasFutuRealtime = false;
      let hasCryptoRealtime = false;
      let hasChainRealtime = false;
      let hasFeishuRealtime = false;
      let hasRatesRealtime = false;

      const nextLoadState: Record<FetchSourceKey, FetchSourceState> = {
        futu: 'fail',
        crypto: 'fail',
        chain: 'fail',
        feishu: 'fail',
        rates: 'fail',
      };

      if (futuRes.status === 'fulfilled' && futuRes.value.ok) {
        setFutuData(await futuRes.value.json());
        setFutuStatus('live');
        hasFutuRealtime = true;
        nextLoadState.futu = 'ok';
      } else {
        setFutuStatus('off');
        nextLoadState.futu = 'fail';
      }

      if (cryptoRes.status === 'fulfilled' && cryptoRes.value.ok) {
        setCryptoData(await cryptoRes.value.json());
        hasCryptoRealtime = true;
        nextLoadState.crypto = 'ok';
      } else {
        nextLoadState.crypto = 'fail';
      }

      if (chainRes.status === 'fulfilled' && chainRes.value.ok) {
        setChainData(await chainRes.value.json());
        hasChainRealtime = true;
        nextLoadState.chain = 'ok';
      } else {
        nextLoadState.chain = 'fail';
      }

      if (feishuRes.status === 'fulfilled' && feishuRes.value.ok) {
        const data: FeishuLatest = await feishuRes.value.json();
        if (!data.error) {
          setFeishuData(data);
          hasFeishuRealtime = true;
          nextLoadState.feishu = 'ok';
        } else {
          nextLoadState.feishu = 'fail';
        }
      } else {
        nextLoadState.feishu = 'fail';
      }

      if (ratesRes.status === 'fulfilled' && ratesRes.value.ok) {
        const rates: RatesResponse = await ratesRes.value.json();
        if (rates?.usd_to_cny) {
          setUsdToCny(rates.usd_to_cny);
          hasRatesRealtime = true;
          nextLoadState.rates = 'ok';
        } else {
          nextLoadState.rates = 'fail';
        }
      } else {
        nextLoadState.rates = 'fail';
      }

      if (cryptoHealthRes.status === 'fulfilled' && cryptoHealthRes.value.ok) {
        const health: CryptoHealthResponse = await cryptoHealthRes.value.json();
        setCryptoHealth(health);
      }

      const hasRealtimeData =
        hasFutuRealtime && hasCryptoRealtime && hasChainRealtime && hasFeishuRealtime && hasRatesRealtime;

      setSourceLoadState(nextLoadState);

      if (hasRealtimeData) {
        setUsingSnapshotFallback(false);
        setSnapshotBuckets(null);
        setLastRealtimeAt(Date.now());
      } else if (snapshotBuckets) {
        setUsingSnapshotFallback(true);
      }
    } catch (err) {
      console.error(err);
      setFutuStatus('off');
      setSourceLoadState({
        futu: 'fail',
        crypto: 'fail',
        chain: 'fail',
        feishu: 'fail',
        rates: 'fail',
      });
    } finally {
      setLoading(false);
      setRealtimeLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const hasSnapshot = await loadLatestSnapshotFallback();
      if (mounted && hasSnapshot) {
        setLoading(false);
      }
      await fetchAllData();
    };

    bootstrap();
    const interval = setInterval(fetchAllData, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const getSortArrow = (direction?: SortDirection) => {
    if (!direction) {
      return '';
    }
    return direction === 'asc' ? '↑' : '↓';
  };

  const handleStockSort = (key: StockSortKey) => {
    setStockSortConfig((current) => ({
      key,
      direction: current?.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const handleCryptoSort = (key: CryptoSortKey) => {
    setCryptoSortConfig((current) => ({
      key,
      direction: current?.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const sortedStockPositions = useMemo(() => {
    const positions = [...(futuData?.stocks?.positions || [])];
    if (!stockSortConfig) {
      return positions;
    }

    return positions.sort((a, b) => {
      const direction = stockSortConfig.direction === 'asc' ? 1 : -1;
      if (stockSortConfig.key === 'code') {
        const left = String(a.code || '');
        const right = String(b.code || '');
        return left.localeCompare(right) * direction;
      }

      const left =
        stockSortConfig.key === 'market_val_usd'
          ? Number(a.market_val_usd ?? a.market_val ?? 0)
          : stockSortConfig.key === 'pl_val_usd'
            ? Number(a.pl_val_usd ?? a.pl_val ?? 0)
            : Number(a[stockSortConfig.key] ?? 0);
      const right =
        stockSortConfig.key === 'market_val_usd'
          ? Number(b.market_val_usd ?? b.market_val ?? 0)
          : stockSortConfig.key === 'pl_val_usd'
            ? Number(b.pl_val_usd ?? b.pl_val ?? 0)
            : Number(b[stockSortConfig.key] ?? 0);

      return (left - right) * direction;
    });
  }, [futuData?.stocks?.positions, stockSortConfig]);

  const riskCryptoPositions = useMemo(
    () => cryptoData.filter((position) => !STABLE_SYMBOLS.has(String(position.symbol).toUpperCase())),
    [cryptoData],
  );

  const sortedCrypto = useMemo(() => {
    const positions = [...riskCryptoPositions];
    if (!cryptoSortConfig) {
      return positions;
    }

    return positions.sort((a, b) => {
      const direction = cryptoSortConfig.direction === 'asc' ? 1 : -1;

      if (cryptoSortConfig.key === 'source') {
        const left = (a.account ? a.exchange + " (" + a.account + ")" : a.exchange).toLowerCase();
        const right = (b.account ? b.exchange + " (" + b.account + ")" : b.exchange).toLowerCase();
        return left.localeCompare(right) * direction;
      }

      if (cryptoSortConfig.key === 'symbol') {
        return a.symbol.localeCompare(b.symbol) * direction;
      }

      const left =
        cryptoSortConfig.key === 'amount'
          ? Number(a.amount || 0)
          : cryptoSortConfig.key === 'price'
            ? Number(a.price || 0)
            : Number(a.value_usd || 0);
      const right =
        cryptoSortConfig.key === 'amount'
          ? Number(b.amount || 0)
          : cryptoSortConfig.key === 'price'
            ? Number(b.price || 0)
            : Number(b.value_usd || 0);

      return (left - right) * direction;
    });
  }, [riskCryptoPositions, cryptoSortConfig]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // ==================== DATA CALCULATION ====================
  
  // Stocks (USD)
  const stocksValue = futuData?.stocks?.totalValue || 0;
  
  // Cash/Funds (USD)
  const cashValueUSD = futuData?.funds?.cash_usd ?? futuData?.funds?.cash ?? 0;
  const fundsValueUSD = futuData?.funds?.fund_assets_usd ?? futuData?.funds?.fundAssets ?? 0;
  
  // Crypto + Chain (USD)
  const stableCryptoUSD = cryptoData.reduce(
    (sum, p) => sum + (STABLE_SYMBOLS.has(String(p.symbol).toUpperCase()) ? (p.value_usd || 0) : 0),
    0,
  );
  const riskCryptoUSD = cryptoData.reduce(
    (sum, p) => sum + (!STABLE_SYMBOLS.has(String(p.symbol).toUpperCase()) ? (p.value_usd || 0) : 0),
    0,
  );
  const stableChainUSD = chainData.reduce(
    (sum, a) => sum + (STABLE_SYMBOLS.has(String(a.symbol).toUpperCase()) ? (a.value_usd || 0) : 0),
    0,
  );
  const riskChainUSD = chainData.reduce(
    (sum, a) => sum + (!STABLE_SYMBOLS.has(String(a.symbol).toUpperCase()) ? (a.value_usd || 0) : 0),
    0,
  );

  const stablecoinTotalUSD = stableCryptoUSD + stableChainUSD;
  const riskCryptoTotalUSD = riskCryptoUSD + riskChainUSD;
  const stocksTotalUSD = stocksValue + cashValueUSD;

  const stocksByCurrencyUSD = (futuData?.stocks?.positions || []).reduce(
    (acc: Record<string, number>, p: StockPosition) => {
      const currency = String(p.currency || 'USD').toUpperCase();
      const valUsd = Number(p.market_val_usd ?? p.market_val ?? 0);
      acc[currency] = (acc[currency] || 0) + valUsd;
      return acc;
    },
    {},
  );

  const stableByAccountToken: Array<{
    label: string;
    symbol: string;
    amount: number;
    valueUsd: number;
  }> = [];

  for (const p of cryptoData) {
    const symbol = String(p.symbol || '').toUpperCase();
    if (!STABLE_SYMBOLS.has(symbol)) {
      continue;
    }
    const label = p.account ? `${p.exchange} (${p.account})` : p.exchange;
    stableByAccountToken.push({
      label,
      symbol,
      amount: Number(p.amount || 0),
      valueUsd: Number(p.value_usd || 0),
    });
  }

  for (const a of chainData) {
    const symbol = String(a.symbol || '').toUpperCase();
    if (!STABLE_SYMBOLS.has(symbol)) {
      continue;
    }
    const address = String(a.address || '');
    const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'wallet';
    const label = `${a.chain} (${shortAddress})`;
    stableByAccountToken.push({
      label,
      symbol,
      amount: Number(a.balance ?? a.value_usd ?? 0),
      valueUsd: Number(a.value_usd || 0),
    });
  }
  
  // ==================== FEISHU DATA ====================
  
  // USD Savings
  const futuFundsUSD = fundsValueUSD;
  const feishuFundsCNY = feishuData?.funds_cny || 0;
  const domesticUsd = feishuData?.usd_savings ?? DEFAULT_DOMESTIC_USD;
  const domesticUsdCny = domesticUsd * usdToCny;
  const futuFundsCny = futuFundsUSD * usdToCny;

  const usdSavingsTotalCny =
    domesticUsdCny + futuFundsCny + stablecoinTotalUSD * usdToCny;
  const usdSavingsTotalUSD = usdToCny ? usdSavingsTotalCny / usdToCny : 0;
  
  // CNY Assets = Cash / PF / Debt / Domestic Funds (from Feishu)
  const balanceCny = feishuData?.balance_cny || 0;
  const providentCny = feishuData?.provident_fund_cny || 0;
  const debtCny = feishuData?.debt_cny || 0;
  const cnyAssetsTotalCny = feishuFundsCNY + balanceCny + providentCny + debtCny;
  const cnyAssetsTotalUSD = usdToCny ? cnyAssetsTotalCny / usdToCny : 0;

  const useSnapshotTotals = Boolean(usingSnapshotFallback && snapshotBuckets);

  const effectiveStocksUSD = useSnapshotTotals ? Number(snapshotBuckets?.stocksUsd || 0) : stocksTotalUSD;
  const effectiveRiskCryptoUSD = useSnapshotTotals ? Number(snapshotBuckets?.cryptoRiskUsd || 0) : riskCryptoTotalUSD;
  const effectiveUsdSavingsUSD = useSnapshotTotals ? Number(snapshotBuckets?.usdSavingsUsd || 0) : usdSavingsTotalUSD;
  const effectiveCnyAssetsUSD = useSnapshotTotals ? Number(snapshotBuckets?.cnyAssetsUsd || 0) : cnyAssetsTotalUSD;

  const usdAssetsCny = (effectiveStocksUSD + effectiveRiskCryptoUSD + effectiveUsdSavingsUSD) * usdToCny;
  const cnyAssetsBucketCny = effectiveCnyAssetsUSD * usdToCny;

  // TOTAL USD
  const grandTotalUSD = useSnapshotTotals
    ? Number(snapshotBuckets?.totalUsd || 0)
    : effectiveStocksUSD + effectiveRiskCryptoUSD + effectiveUsdSavingsUSD + effectiveCnyAssetsUSD;

  // Display in CNY
  const displayTotalCNY = grandTotalUSD * usdToCny;
  const totalCnyBase = displayTotalCNY > 0 ? displayTotalCNY : 1;
  const stocksRatio = Math.min(100, ((effectiveStocksUSD * usdToCny) / totalCnyBase) * 100);
  const cryptoRatio = Math.min(100, ((effectiveRiskCryptoUSD * usdToCny) / totalCnyBase) * 100);
  const usdRatio = Math.min(100, ((effectiveUsdSavingsUSD * usdToCny) / totalCnyBase) * 100);
  const cnyRatio = Math.min(100, ((effectiveCnyAssetsUSD * usdToCny) / totalCnyBase) * 100);

  const stockBreakdownItems = [
    { label: 'US Stocks', valueCny: (stocksByCurrencyUSD.USD || 0) * usdToCny },
    { label: 'HK Stocks', valueCny: (stocksByCurrencyUSD.HKD || 0) * usdToCny },
    { label: 'CN Stocks', valueCny: (stocksByCurrencyUSD.CNY || 0) * usdToCny },
    { label: 'Futu Cash', valueCny: cashValueUSD * usdToCny },
  ].filter((item) => item.valueCny > 0.5);

  const cnyBreakdownItems = [
    { label: 'Domestic Funds', valueCny: feishuFundsCNY },
    { label: 'Cash Balance', valueCny: balanceCny },
    { label: 'Provident Fund', valueCny: providentCny },
    { label: 'Receivables (Debt)', valueCny: debtCny },
  ].filter((item) => item.valueCny > 0.5);


  const riskByTokenUSD: Record<string, number> = {};

  for (const p of cryptoData) {
    const symbol = String(p.symbol || '').toUpperCase();
    if (STABLE_SYMBOLS.has(symbol)) {
      continue;
    }
    riskByTokenUSD[symbol] = (riskByTokenUSD[symbol] || 0) + Number(p.value_usd || 0);
  }

  for (const a of chainData) {
    const symbol = String(a.symbol || '').toUpperCase();
    if (STABLE_SYMBOLS.has(symbol)) {
      continue;
    }
    riskByTokenUSD[symbol] = (riskByTokenUSD[symbol] || 0) + Number(a.value_usd || 0);
  }

  const riskTokenBreakdown = Object.entries(riskByTokenUSD)
    .map(([symbol, valueUsd]) => ({
      symbol,
      valueUsd,
      ratio: riskCryptoTotalUSD > 0 ? valueUsd / riskCryptoTotalUSD : 0,
    }))
    .filter((item) => item.valueUsd > 0 && item.ratio >= 0.05)
    .sort((a, b) => b.valueUsd - a.valueUsd);

  const okxSource = cryptoHealth?.ingest?.okx?.source || 'none';
  const okxTokenSource = cryptoHealth?.ingest?.okx?.tokenSource || 'none';
  const okxLastErrorRaw = String(cryptoHealth?.ingest?.okx?.lastError || '').trim();
  const okxLastError = okxLastErrorRaw ? okxLastErrorRaw.slice(0, 120) : '';
  const binanceSource = cryptoHealth?.ingest?.binance?.source || 'none';

  const okxStatusLabel =
    okxSource === 'web'
      ? `OKX: WEB (${okxTokenSource})`
      : okxSource === 'v5'
        ? 'OKX: V5 API'
        : 'OKX: OFF';
  const binanceStatusLabel =
    binanceSource === 'api-key'
      ? 'Binance: API Key'
      : binanceSource === 'snapshot'
        ? 'Binance: Snapshot'
        : 'Binance: OFF';
  const futuStatusLabel = futuStatus === 'live' ? 'Futu: Live' : 'Futu: OFF';

  const okxStatusClass =
    okxSource === 'web'
      ? 'border-blue-500/40 bg-blue-900/30 text-blue-300'
      : okxSource === 'v5'
        ? 'border-indigo-500/40 bg-indigo-900/30 text-indigo-300'
        : 'border-gray-700 bg-gray-900/50 text-gray-500';
  const binanceStatusClass =
    binanceSource === 'api-key'
      ? 'border-yellow-500/40 bg-yellow-900/30 text-yellow-300'
      : binanceSource === 'snapshot'
        ? 'border-amber-500/40 bg-amber-900/30 text-amber-300'
        : 'border-gray-700 bg-gray-900/50 text-gray-500';
  const futuStatusClass =
    futuStatus === 'live'
      ? 'border-emerald-500/40 bg-emerald-900/30 text-emerald-300'
      : 'border-gray-700 bg-gray-900/50 text-gray-500';

  const hasBinanceData = cryptoData.some(
    (p) => String(p.exchange || '').toLowerCase() === 'binance',
  );
  const hasOkxWebData = cryptoData.some(
    (p) => String(p.exchange || '').toLowerCase() === 'okx' && p.type === 'web',
  );

  const cryptoDataWarnings: string[] = [];
  if (futuStatus !== 'live') {
    cryptoDataWarnings.push('Futu data unavailable: stocks/funds may be stale or missing.');
  }
  if (binanceSource === 'api-key' && !hasBinanceData) {
    cryptoDataWarnings.push('Binance data missing: API is configured but returned no positions.');
  }
  if (binanceSource === 'snapshot') {
    cryptoDataWarnings.push('Binance realtime unavailable: using local snapshot fallback.');
  }
  if (okxSource === 'v5') {
    cryptoDataWarnings.push(
      okxLastError
        ? `OKX Web unavailable (${okxLastError}). Currently using V5 fallback only.`
        : 'OKX Web unavailable: currently using V5 fallback only.',
    );
  }
  if (okxSource === 'web' && !hasOkxWebData) {
    cryptoDataWarnings.push('OKX Web expected but no web positions returned.');
  }

  const sourceProgressItems: Array<{ key: FetchSourceKey; label: string }> = [
    { key: 'futu', label: 'Futu' },
    { key: 'crypto', label: 'Crypto' },
    { key: 'chain', label: 'Chain' },
    { key: 'feishu', label: 'Domestic' },
    { key: 'rates', label: 'Rates' },
  ];

  const readySourceCount = sourceProgressItems.filter(
    (item) => sourceLoadState[item.key] === 'ok',
  ).length;
  const failedSourceNames = sourceProgressItems
    .filter((item) => sourceLoadState[item.key] === 'fail')
    .map((item) => item.label);
  const showSourceProgress =
    realtimeLoading || usingSnapshotFallback || failedSourceNames.length > 0;

  const getSourceProgressClass = (state: FetchSourceState) => {
    if (state === 'ok') return 'border-emerald-500/40 bg-emerald-900/30 text-emerald-200';
    if (state === 'loading') return 'border-sky-500/40 bg-sky-900/30 text-sky-200';
    if (state === 'fail') return 'border-amber-500/40 bg-amber-900/30 text-amber-200';
    return 'border-gray-700 bg-gray-900/40 text-gray-400';
  };

  const getSourceProgressLabel = (state: FetchSourceState) => {
    if (state === 'ok') return 'OK';
    if (state === 'loading') return '加载中';
    if (state === 'fail') return '失败';
    return '待命';
  };

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="group/nav pointer-events-none fixed inset-y-0 left-0 z-40 w-64">
        <div className="pointer-events-auto absolute inset-y-0 left-0 w-5" />
        <aside className="pointer-events-auto absolute left-0 top-6 w-52 rounded-xl border border-gray-800 bg-gray-900/90 p-3 shadow-xl transition-all duration-200 -translate-x-[calc(100%-12px)] opacity-0 group-hover/nav:translate-x-0 group-hover/nav:opacity-100 hover:translate-x-0 hover:opacity-100">
          <div className="mb-2 px-2 text-xs uppercase tracking-wider text-gray-500">Navigation</div>
          <button
            className={`mb-2 w-full rounded-md px-3 py-2 text-left text-sm transition ${
              activeTab === 'dashboard'
                ? 'bg-blue-900/40 text-blue-200 border border-blue-500/30'
                : 'text-gray-300 hover:bg-gray-800/60'
            }`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
              activeTab === 'feishu'
                ? 'bg-emerald-900/40 text-emerald-200 border border-emerald-500/30'
                : 'text-gray-300 hover:bg-gray-800/60'
            }`}
            onClick={() => setActiveTab('feishu')}
          >
            Domestic Data
          </button>
        </aside>
      </div>

      <main className="mx-auto max-w-[1600px] min-w-0">
          {activeTab === 'dashboard' ? (
            <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Wealth Dashboard V2</h1>
            <p className="mt-1 text-sm text-gray-500">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500 mr-2"></span>
              {new Date().toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs font-medium uppercase tracking-wider text-gray-500">Total Net Worth</div>
            <div className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              {formatCny(displayTotalCNY)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {formatUsd(grandTotalUSD)}
            </div>
          </div>
        </div>

        {(realtimeLoading || usingSnapshotFallback) && (
          <div className="mb-4 rounded-lg border border-sky-800/60 bg-sky-950/30 px-3 py-2 text-xs text-sky-200">
            {realtimeLoading
              ? '实时数据加载中（通常 3-8 秒）：当前先显示最近快照，金额会在加载完成后自动更新。'
              : '部分实时数据暂不可用：已回退到最近快照（非实时），系统会自动重试。'}
          </div>
        )}

        {showSourceProgress && (
          <div className="mb-4 rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
            <div className="flex items-center justify-between text-[11px] text-gray-400">
              <span>实时拉取进度</span>
              <span>{readySourceCount}/{sourceProgressItems.length} 就绪</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-gray-800">
              <div
                className="h-1.5 rounded-full bg-sky-500 transition-all"
                style={{ width: `${(readySourceCount / sourceProgressItems.length) * 100}%` }}
              ></div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              {sourceProgressItems.map((item) => (
                <span
                  key={item.key}
                  className={`rounded border px-2 py-1 ${getSourceProgressClass(sourceLoadState[item.key])}`}
                >
                  {item.label}: {getSourceProgressLabel(sourceLoadState[item.key])}
                </span>
              ))}
            </div>
            {failedSourceNames.length > 0 && (
              <div className="mt-2 text-[11px] text-amber-300">
                当前卡在: {failedSourceNames.join(' / ')}
              </div>
            )}
          </div>
        )}

        {lastRealtimeAt && !realtimeLoading && (
          <div className="mb-4 text-xs text-gray-500">
            实时更新时间： {new Date(lastRealtimeAt).toLocaleTimeString()}
          </div>
        )}

        {/* Charts */}
        <div className="mb-8 grid gap-6 lg:grid-cols-3">
          <div className="group rounded-xl border border-gray-800 bg-gray-900/50 p-5 shadow-lg transition-all hover:bg-gray-900">
            <div className="mb-4 font-semibold text-gray-200">Asset Distribution</div>
            <AssetDistributionChart
              stocksCny={effectiveStocksUSD * usdToCny}
              cryptoCny={effectiveRiskCryptoUSD * usdToCny}
              usdSavingsCny={effectiveUsdSavingsUSD * usdToCny}
              cnyAssetsCny={effectiveCnyAssetsUSD * usdToCny}
            />
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 shadow-lg transition-all hover:bg-gray-900">
            <div className="mb-4 font-semibold text-gray-200">USD vs CNY Split</div>
            <CurrencySplitChart
              usdAssetsCny={usdAssetsCny}
              cnyAssetsCny={cnyAssetsBucketCny}
            />
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <div className="mb-4 font-semibold text-gray-200">Portfolio Trend</div>
            <TrendChart />
          </div>
        </div>

        {/* Detailed Charts */}
        <div className="mb-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <div className="mb-4 font-semibold text-gray-200 flex items-center gap-2">
              <span className="text-blue-400">📈</span> Stock Distribution
            </div>
            <StockDistributionChart positions={futuData?.stocks?.positions || []} />
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <div className="mb-4 font-semibold text-gray-200 flex items-center gap-2">
              <span className="text-yellow-400">🪙</span> Crypto Distribution
            </div>
            <CryptoDistributionChart positions={cryptoData} />
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-500">Data Source</span>
          <span className={`rounded-md border px-2 py-1 ${futuStatusClass}`}>{futuStatusLabel}</span>
          <span className={`rounded-md border px-2 py-1 ${okxStatusClass}`}>{okxStatusLabel}</span>
          <span className={`rounded-md border px-2 py-1 ${binanceStatusClass}`}>{binanceStatusLabel}</span>
        </div>

        {cryptoDataWarnings.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
            <div className="font-semibold">Data Warning</div>
            <div className="mt-1 space-y-1">
              {cryptoDataWarnings.map((warning) => (
                <div key={warning}>- {warning}</div>
              ))}
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          {/* USD Savings */}
          <div className="order-3 group rounded-xl border border-gray-800 bg-gray-900/50 p-5 shadow-lg transition-all hover:bg-gray-900">
            <div className="flex items-center gap-2">
              <div className="text-xs font-medium uppercase tracking-wider text-gray-500">USD Savings</div>
            </div>
            <div className="mt-2 text-2xl font-bold text-green-400">
              {formatCny(effectiveUsdSavingsUSD * usdToCny)}
            </div>
            <div className="text-xs text-gray-500">{formatUsd(effectiveUsdSavingsUSD)}</div>
            <div className="text-[11px] text-gray-500 mt-1">
              Stablecoins {formatUsd(stablecoinTotalUSD)}
            </div>
            {((binanceSource === 'api-key' && !hasBinanceData) || binanceSource === 'snapshot') && (
              <div className="text-[11px] text-amber-300 mt-1">Binance stablecoins are non-realtime or partially missing.</div>
            )}
            <div className="mt-3 h-1 w-full rounded-full bg-gray-800">
              <div className="h-1 rounded-full bg-emerald-500" style={{ width: `${usdRatio}%` }}></div>
            </div>
            <div className="mt-3 border-t border-gray-800/70 pt-2 text-[13px] leading-6 text-gray-400">
                <div>Domestic USD: {formatUsd(domesticUsd)}</div>
                <div>Futu Funds: {formatUsd(futuFundsUSD)}</div>
                <div>Stablecoins (Total): {formatUsd(stablecoinTotalUSD)}</div>
                {stableByAccountToken.length > 0 && (
                  <div className="mt-1 ml-2 max-h-28 overflow-auto border-l border-gray-700/80 pl-3 space-y-1 text-[12px] leading-5 text-gray-300">
                      {stableByAccountToken
                        .sort((a, b) => b.valueUsd - a.valueUsd)
                        .map((item, index) => (
                          <div key={`${item.label}-${item.symbol}-${index}`}>
                            {item.label} {item.symbol}: {item.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                          </div>
                        ))}
                  </div>
                )}
              </div>
            
          </div>

          {/* Stocks */}
          <div className="order-1 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2"><span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>
                <div className="text-xs font-medium uppercase tracking-wider text-gray-500">Stocks</div>
              </div>
            </div>
            <div className="text-[11px] text-gray-500 mt-1">Live</div>
            <div className="mt-2 text-2xl font-bold text-blue-400">
              {formatCny(effectiveStocksUSD * usdToCny)}
            </div>
            <div className="text-xs text-gray-500">{formatUsd(effectiveStocksUSD)}</div>
            <div className="mt-3 h-1 w-full rounded-full bg-gray-800">
              <div className="h-1 rounded-full bg-blue-500" style={{ width: `${stocksRatio}%` }}></div>
            </div>
            <div className="mt-3 border-t border-gray-800/70 pt-2 text-[13px] leading-6 text-gray-400">
                {stockBreakdownItems.map((item) => (
                  <div key={item.label}>{item.label}: {formatCny(item.valueCny)}</div>
                ))}
              </div>
          </div>

          {/* Crypto (Risk) */}
          <div className="order-2 group rounded-xl border border-gray-800 bg-gray-900/50 p-5 shadow-lg transition-all hover:bg-gray-900">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2"><span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-yellow-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span></span>
              <div className="text-xs font-medium uppercase tracking-wider text-gray-500">Crypto (Risk)</div>
            </div>
            <div className="text-[11px] text-gray-500 mt-1">Live</div>
            <div className="mt-2 text-2xl font-bold text-yellow-400">
              {formatCny(effectiveRiskCryptoUSD * usdToCny)}
            </div>
            <div className="text-xs text-gray-500">{formatUsd(effectiveRiskCryptoUSD)}</div>
            <div className="mt-3 h-1 w-full rounded-full bg-gray-800">
              <div className="h-1 rounded-full bg-yellow-500" style={{ width: `${cryptoRatio}%` }}></div>
            </div>
            {riskTokenBreakdown.length > 0 && (
              <div className="mt-3 border-t border-gray-800/70 pt-2 text-[13px] leading-6 text-gray-400">
                {riskTokenBreakdown.map((item) => (
                  <div key={item.symbol} className="flex items-center justify-between gap-2">
                    <span>{item.symbol}</span>
                    <span className="text-gray-300">
                      {(item.ratio * 100).toFixed(1)}% · {formatUsd(item.valueUsd)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CNY Assets */}
          <div className="order-4 group rounded-xl border border-gray-800 bg-gray-900/50 p-5 shadow-lg transition-all hover:bg-gray-900">
            <div className="flex items-center gap-2">
              <div className="text-xs font-medium uppercase tracking-wider text-gray-500">CNY Assets</div>
            </div>
            <div className="mt-2 text-2xl font-bold text-orange-400">
              {formatCny(effectiveCnyAssetsUSD * usdToCny)}
            </div>
            <div className="text-xs text-gray-500">{formatUsd(effectiveCnyAssetsUSD)}</div>
            <div className="font-mono text-xs text-gray-600">Cash / PF / Debt / Funds</div>
            <div className="mt-3 h-1 w-full rounded-full bg-gray-800">
              <div className="h-1 rounded-full bg-orange-500" style={{ width: `${cnyRatio}%` }}></div>
            </div>
            <div className="mt-3 border-t border-gray-800/70 pt-2 text-[13px] leading-6 text-gray-400">
                {cnyBreakdownItems.map((item) => (
                  <div key={item.label}>{item.label}: {formatCny(item.valueCny)}</div>
                ))}
              </div>
          </div>
        </div>

        {/* Stock Positions Table */}
        {(futuData?.stocks?.positions?.length ?? 0) > 0 && (
          <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
            <div className="border-b border-gray-800 px-6 py-4 font-semibold text-gray-200">Stock Positions</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/50 text-xs text-gray-500">
                  <tr>
                    <th className="py-2 px-4 text-left cursor-pointer hover:text-white" onClick={() => handleStockSort('code')}>
                      Stock {stockSortConfig?.key === 'code' ? getSortArrow(stockSortConfig.direction) : '↕'}
                    </th>
                    <th className="py-2 px-4 text-right cursor-pointer hover:text-white" onClick={() => handleStockSort('market_val_usd')}>
                      Position {stockSortConfig?.key === 'market_val_usd' ? getSortArrow(stockSortConfig.direction) : '↕'}
                    </th>
                    <th className="py-2 px-4 text-right cursor-pointer hover:text-white" onClick={() => handleStockSort('nominal_price')}>
                      Price {stockSortConfig?.key === 'nominal_price' ? getSortArrow(stockSortConfig.direction) : '↕'}
                    </th>
                    <th className="py-2 px-4 text-right cursor-pointer hover:text-white" onClick={() => handleStockSort('pl_val_usd')}>
                      Total P/L {stockSortConfig?.key === 'pl_val_usd' ? getSortArrow(stockSortConfig.direction) : '↕'}
                    </th>
                    <th className="py-2 px-4 text-right cursor-pointer hover:text-white" onClick={() => handleStockSort('price_change_24h_value')}>
                      24h Change {stockSortConfig?.key === 'price_change_24h_value' ? getSortArrow(stockSortConfig.direction) : '↕'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStockPositions.map((p: StockPosition, idx: number) => (
                    <tr key={p.code + "-" + idx} className="border-b border-gray-800/50 hover:bg-gray-800/50">
                      <td className="py-3 px-4">
                        <div className="font-mono text-blue-300">{p.code}</div>
                        <div className="mt-0.5 text-xs text-gray-400">{p.stock_name}</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="font-mono font-bold text-white">${(p.market_val_usd ?? p.market_val).toLocaleString()}</div>
                        <div className="mt-0.5 text-xs text-gray-400">Qty: {p.qty}</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="font-mono text-gray-200">{formatUsd(p.nominal_price || 0)}</div>
                        <div className="mt-0.5 text-xs text-gray-400">Cost: {formatUsd(p.cost_price || 0)}</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className={`font-mono ${(p.pl_val_usd ?? p.pl_val) >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {(p.pl_val_usd ?? p.pl_val) >= 0 ? '+' : '-'}${Math.abs(p.pl_val_usd ?? p.pl_val).toLocaleString()}
                        </div>
                        <div className={`mt-0.5 text-xs ${p.pl_ratio >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {p.pl_ratio >= 0 ? '+' : '-'}{Math.abs(p.pl_ratio).toFixed(2)}%
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className={`font-mono ${(p.price_change_24h_value ?? 0) >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {(p.price_change_24h_value ?? 0) >= 0 ? '+' : '-'}${Math.abs(p.price_change_24h_value ?? 0).toFixed(2)}
                        </div>
                        <div
                          className={`mt-0.5 text-xs ${(p.price_change_24h_percent ?? 0) >= 0 ? 'text-red-400' : 'text-green-400'}`}
                        >
                          {(p.price_change_24h_percent ?? 0) >= 0 ? '+' : '-'}
                          {Math.abs(p.price_change_24h_percent ?? 0).toFixed(2)}%
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <CryptoTable
          positions={sortedCrypto}
          sortConfig={cryptoSortConfig}
          onSort={handleCryptoSort}
          getSortArrow={getSortArrow}
          getSourceBadgeClass={getSourceBadgeClass}
          formatUsd={formatUsd}
        />

        <ChainTable assets={chainData} formatUsd={formatUsd} />
            </div>
          ) : (
            <FeishuDataPanel />
          )}
      </main>
    </div>
  );
}
