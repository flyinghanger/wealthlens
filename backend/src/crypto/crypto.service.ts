import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosRequestConfig } from 'axios';
import * as ccxt from 'ccxt';
import * as fs from 'fs';
import * as path from 'path';
import {
  calculate24hChangeValue,
  toFiniteNumber,
} from '../common/market-change.util';

export interface CryptoPosition {
  symbol: string;
  amount: number;
  value_usd: number;
  price: number;
  exchange: string;
  type: 'spot' | 'web' | 'funding' | 'earn' | 'futures' | 'trading';
  account?: string;
  realtime?: boolean;
  price_change_24h_percent?: number;
  price_change_24h_value?: number;
}

interface SecretsConfig {
  okx?: {
    apiKey?: string;
    secret?: string;
    password?: string;
    webToken?: string;
  };
  binance?: {
    apiKey?: string;
    secret?: string;
  };
  bitget?: {
    apiKey?: string;
    secret?: string;
    password?: string;
  };
  hyperliquid?: {
    wallet?: string;
  };
  network?: {
    proxy?: string;
  };
}

export interface CryptoIngestStatus {
  okx: {
    source: 'web' | 'v5' | 'none';
    tokenSource: 'config' | 'legacy' | 'none';
    lastError?: string;
  };
  binance: {
    source: 'api-key' | 'snapshot' | 'none';
    hasCredentials: boolean;
    lastError?: string;
  };
  bitget: {
    source: 'api-key' | 'none';
    hasCredentials: boolean;
    lastError?: string;
  };
  updatedAt: number;
}

interface BinanceFetchResult {
  positions: CryptoPosition[];
  restricted: boolean;
  hadError: boolean;
  lastError?: string;
}

interface TickerSnapshot {
  price: number;
  change24hPercent: number;
  change24hValue: number;
}

const STABLE_COINS = new Set(['USDT', 'USDC', 'USD1', 'DAI', 'FDUSD', 'USDE']);
const PRICE_FALLBACKS: Record<string, number> = {
  HYPE: 34,
};

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private secrets: SecretsConfig = {};
  private readonly tickerCache = new Map<string, TickerSnapshot>();
  private ingestStatus: CryptoIngestStatus = {
    okx: { source: 'none', tokenSource: 'none' },
    binance: { source: 'none', hasCredentials: false },
    bitget: { source: 'none', hasCredentials: false },
    updatedAt: 0,
  };

  constructor() {
    this.loadSecrets();
  }

  private loadSecrets() {
    try {
      const candidates = [
        path.resolve(__dirname, '../../../config/secrets.json'),
        path.join(process.cwd(), '..', 'config', 'secrets.json'),
        path.join(process.cwd(), 'config', 'secrets.json'),
      ];

      const configPath = candidates.find((candidate) => fs.existsSync(candidate));
      if (configPath) {
        this.secrets = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.logger.log(`Crypto secrets loaded from ${configPath}`);
      } else {
        this.logger.warn('Crypto secrets not found, exchange private data disabled');
      }
    } catch (error) {
      this.logger.warn(`Failed to load secrets: ${error.message}`);
    }
  }

  private loadLegacyOkxToken() {
    try {
      const candidates = [
        path.resolve(__dirname, '../../../../wealth-dashboard/scripts/crypto_fetcher.py'),
        path.join(process.cwd(), '..', '..', 'wealth-dashboard', 'scripts', 'crypto_fetcher.py'),
        path.join(process.cwd(), '..', 'wealth-dashboard', 'scripts', 'crypto_fetcher.py'),
      ];

      const legacyPath = candidates.find((candidate) => fs.existsSync(candidate));
      if (!legacyPath) {
        return '';
      }

      const content = fs.readFileSync(legacyPath, 'utf8');
      const match = content.match(/'authorization'\s*:\s*'([^']+)'/);
      return match?.[1] || '';
    } catch {
      return '';
    }
  }

  private getOkxToken() {
    const configured = String(this.secrets.okx?.webToken || '').trim();
    if (configured) {
      this.ingestStatus.okx.tokenSource = 'config';
      return configured;
    }

    const legacyToken = this.loadLegacyOkxToken();
    if (legacyToken) {
      this.logger.log('Using legacy OKX web token from wealth-dashboard/scripts/crypto_fetcher.py');
      this.ingestStatus.okx.tokenSource = 'legacy';
      return legacyToken;
    }

    this.ingestStatus.okx.tokenSource = 'none';
    return '';
  }

  private getBinanceKeys() {
    return {
      apiKey: this.secrets.binance?.apiKey || '',
      secret: this.secrets.binance?.secret || '',
    };
  }

  private getProxyUrl() {
    const configured = String(this.secrets.network?.proxy || '').trim();
    if (configured) {
      return configured;
    }

    const envProxy = String(process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '').trim();
    if (envProxy) {
      return envProxy;
    }

    return '';
  }

  private parseAxiosProxyConfig(proxyUrl: string): AxiosRequestConfig | null {
    try {
      const parsed = new URL(proxyUrl);
      if (!parsed.hostname) {
        return null;
      }

      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }

      const port = parsed.port
        ? Number(parsed.port)
        : parsed.protocol === 'https:'
          ? 443
          : 80;

      return {
        proxy: {
          protocol: parsed.protocol.replace(':', ''),
          host: parsed.hostname,
          port: Number.isFinite(port) ? port : 80,
          auth:
            parsed.username || parsed.password
              ? {
                  username: decodeURIComponent(parsed.username || ''),
                  password: decodeURIComponent(parsed.password || ''),
                }
              : undefined,
        },
      };
    } catch {
      return null;
    }
  }

  private isRestrictedLocationError(error: any) {
    const message = String(error?.message || '').toLowerCase();
    return (
      message.includes('restricted location') ||
      message.includes('eligibility') ||
      message.includes(' 451 ') ||
      message.includes('451')
    );
  }

  private normalizeTickerSnapshot(rawTicker: any): TickerSnapshot | null {
    const price = toFiniteNumber(rawTicker?.last, 0);
    if (price <= 0) {
      return null;
    }

    const directPercent = toFiniteNumber(rawTicker?.percentage, Number.NaN);
    const directChange = toFiniteNumber(rawTicker?.change, Number.NaN);

    if (Number.isFinite(directPercent) && Number.isFinite(directChange)) {
      return { price, change24hPercent: directPercent, change24hValue: directChange };
    }

    if (Number.isFinite(directPercent)) {
      return { price, change24hPercent: directPercent, change24hValue: 0 };
    }

    const open = toFiniteNumber(rawTicker?.open, 0);
    if (open > 0) {
      return {
        price,
        change24hPercent: ((price - open) / open) * 100,
        change24hValue: price - open,
      };
    }

    const previousClose = toFiniteNumber(rawTicker?.previousClose, 0);
    if (previousClose > 0) {
      return {
        price,
        change24hPercent: ((price - previousClose) / previousClose) * 100,
        change24hValue: price - previousClose,
      };
    }

    return { price, change24hPercent: 0, change24hValue: 0 };
  }

  private async fetchTickerSnapshot(
    exchange: ccxt.Exchange | undefined,
    pairs: string[],
  ): Promise<TickerSnapshot | null> {
    if (!exchange) {
      return null;
    }

    for (const pair of pairs) {
      try {
        const ticker = await exchange.fetch_ticker(pair);
        const normalized = this.normalizeTickerSnapshot(ticker);
        if (normalized) {
          return normalized;
        }
      } catch {
        // ignore missing markets
      }
    }

    return null;
  }

  private async getTickerSnapshot(
    symbol: string,
    binance?: ccxt.binance,
    okx?: ccxt.okx,
  ): Promise<TickerSnapshot> {
    const normalized = symbol.toUpperCase();
    if (STABLE_COINS.has(normalized)) {
      return { price: 1, change24hPercent: 0, change24hValue: 0 };
    }

    const cached = this.tickerCache.get(normalized);
    if (cached) {
      return cached;
    }

    const pairs = [`${normalized}/USDT`, `${normalized}/USDC`];

    const binanceTicker = await this.fetchTickerSnapshot(binance, pairs);
    if (binanceTicker) {
      this.tickerCache.set(normalized, binanceTicker);
      return binanceTicker;
    }

    const okxTicker = await this.fetchTickerSnapshot(okx, pairs);
    if (okxTicker) {
      this.tickerCache.set(normalized, okxTicker);
      return okxTicker;
    }

    const fallbackPrice = toFiniteNumber(PRICE_FALLBACKS[normalized], 0);
    const fallbackSnapshot: TickerSnapshot = {
      price: fallbackPrice,
      change24hPercent: 0,
      change24hValue: 0,
    };

    if (fallbackPrice > 0) {
      this.tickerCache.set(normalized, fallbackSnapshot);
    }

    return fallbackSnapshot;
  }

  private async enrichWithPrices(
    positions: CryptoPosition[],
    binance: ccxt.binance,
    okx?: ccxt.okx,
  ) {
    for (const p of positions) {
      const tickerSnapshot = await this.getTickerSnapshot(p.symbol, binance, okx);

      if ((!p.price || p.price <= 0) && tickerSnapshot.price > 0) {
        p.price = tickerSnapshot.price;
      }

      if ((!p.value_usd || p.value_usd <= 0) && p.price > 0) {
        p.value_usd = p.amount * p.price;
      }

      p.price_change_24h_percent = tickerSnapshot.change24hPercent;
      p.price_change_24h_value = calculate24hChangeValue(
        p.value_usd,
        tickerSnapshot.change24hPercent,
      );
    }
  }

  private filterDust(positions: CryptoPosition[]) {
    return positions.filter((p) => p.value_usd >= 1);
  }

  private async getOKXWebData(binancePublic: ccxt.binance): Promise<CryptoPosition[]> {
    const positions: CryptoPosition[] = [];
    const okxPublic = new ccxt.okx({ enableRateLimit: true });
    const webToken = this.getOkxToken();

    if (!webToken) {
      return positions;
    }

    const baseUrls = ['https://www.okx.com', 'https://my.okx.com'];
    const transportCandidates: Array<{ name: string; config: AxiosRequestConfig }> = [
      { name: 'direct', config: { proxy: false } },
    ];

    const configuredProxy = this.getProxyUrl();
    const localProxy = 'http://127.0.0.1:7890';
    const proxySet = new Set<string>();

    for (const candidate of [configuredProxy, localProxy]) {
      const normalized = String(candidate || '').trim();
      if (!normalized || proxySet.has(normalized)) {
        continue;
      }
      proxySet.add(normalized);
      const proxyConfig = this.parseAxiosProxyConfig(normalized);
      if (proxyConfig) {
        transportCandidates.push({ name: `proxy:${normalized}`, config: proxyConfig });
      }
    }

    let lastError = '';

    for (const baseUrl of baseUrls) {
      for (const transport of transportCandidates) {
        const url = `${baseUrl}/v2/asset/balance/balance-portfolio?valuationUnit=USD&operationControl=true&t=${Date.now()}`;
        try {
          const response = await axios.get(url, {
            headers: {
              accept: 'application/json',
              'app-type': 'web',
              authorization: webToken,
              devid: 'b0a8ab6f-23c1-41f0-a5a0-c2fe81f861b5',
              'user-agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              'x-request-timestamp': String(Math.floor(Date.now() / 1000)),
            },
            timeout: 20000,
            validateStatus: () => true,
            ...transport.config,
          });

          if (response.status >= 400) {
            throw new Error(`HTTP ${response.status}`);
          }

          if (response.data?.code !== 0 || !response.data?.data?.crypto?.balances) {
            const code = String(response.data?.code ?? 'unknown');
            const msg = String(response.data?.msg || response.data?.message || 'unknown');
            throw new Error(`OKX code=${code} msg=${msg}`);
          }

          for (const b of response.data.data.crypto.balances) {
            const qty = parseFloat(b.balance) || 0;
            const valUsd = parseFloat(b.usdValuation) || 0;

            if (qty > 0.00000001) {
              positions.push({
                symbol: b.currency,
                amount: qty,
                value_usd: valUsd || 0,
                price: valUsd > 0 ? valUsd / qty : 0,
                exchange: 'OKX',
                type: 'web',
                account: 'web',
              });
            }
          }

          this.ingestStatus.okx.lastError = undefined;
          this.logger.log(
            `OKX web portfolio loaded from ${baseUrl} via ${transport.name}: ${positions.length} positions`,
          );
          await this.enrichWithPrices(positions, binancePublic, okxPublic);
          return this.filterDust(positions);
        } catch (error) {
          lastError = error.message;
          this.logger.warn(
            `OKX Web API failed (${baseUrl}, ${transport.name}): ${error.message}`,
          );
        }
      }
    }

    this.ingestStatus.okx.lastError = lastError || 'unknown error';

    await this.enrichWithPrices(positions, binancePublic, okxPublic);
    return this.filterDust(positions);
  }

  private async getOKXV5Data(
    binancePublic: ccxt.binance,
  ): Promise<CryptoPosition[]> {
    const positions: CryptoPosition[] = [];
    const conf = this.secrets.okx;
    if (!conf?.apiKey || !conf?.secret || !conf?.password) {
      return positions;
    }

    const okx = new ccxt.okx({
      apiKey: conf.apiKey,
      secret: conf.secret,
      password: conf.password,
      enableRateLimit: true,
    });

    // 1. Trading
    try {
      const balance = await okx.fetchBalance();
      for (const [symbol, qty] of Object.entries(balance.total || {})) {
        const amount = Number(qty);
        if (amount > 0) {
          positions.push({
            symbol,
            amount,
            value_usd: 0,
            price: 0,
            exchange: 'OKX',
            type: 'trading',
            account: 'trading',
          });
        }
      }
    } catch (error) {
      this.logger.warn(`OKX trading balance failed: ${error.message}`);
    }

    // 2. Funding
    try {
      const res = await okx.private_get_asset_balances();
      if (res?.code === '0') {
        for (const item of res.data || []) {
          const amount = Number(item.availBal || 0) + Number(item.frozenBal || 0);
          if (amount > 0) {
            positions.push({
              symbol: item.ccy,
              amount,
              value_usd: 0,
              price: 0,
              exchange: 'OKX',
              type: 'funding',
              account: 'funding',
            });
          }
        }
      }
    } catch (error) {
      this.logger.warn(`OKX funding failed: ${error.message}`);
    }

    // 3. Earn
    try {
      const res = await okx.private_get_finance_savings_balance();
      if (res?.code === '0') {
        for (const item of res.data || []) {
          const amount = Math.max(Number(item.amt || 0), Number(item.pendingAmt || 0));
          if (amount > 0) {
            positions.push({
              symbol: item.ccy,
              amount,
              value_usd: 0,
              price: 0,
              exchange: 'OKX',
              type: 'earn',
              account: 'earn',
            });
          }
        }
      }
    } catch (error) {
      this.logger.warn(`OKX earn failed: ${error.message}`);
    }

    await this.enrichWithPrices(positions, binancePublic, okx);
    return this.filterDust(positions);
  }

  private async getBinanceData(): Promise<BinanceFetchResult> {
    const { apiKey, secret } = this.getBinanceKeys();

    if (!apiKey || !secret) {
      return { positions: [], restricted: false, hadError: false };
    }

    const fetchByMode = async (proxyUrl: string | null, mode: string): Promise<BinanceFetchResult> => {
      const positions: CryptoPosition[] = [];
      const ldSpotCandidates = new Map<string, number>();
      const earnSymbols = new Set<string>();
      let restricted = false;
      let hadError = false;
      let lastError = '';

      const proxyOptions = proxyUrl
        ? ({ httpsProxy: proxyUrl } as const)
        : {};

      const binance = new ccxt.binance({
        apiKey,
        secret,
        enableRateLimit: true,
        ...proxyOptions,
      });

      const binancePublic = new ccxt.binance({
        enableRateLimit: true,
        ...proxyOptions,
      });

      // Spot
      try {
        const balance = await binance.fetchBalance();
        if (balance.info?.balances) {
          for (const asset of balance.info.balances) {
            const qty = Number(asset.free || 0) + Number(asset.locked || 0);
            if (qty > 0.00000001) {
              const rawSymbol = String(asset.asset || '').toUpperCase();
              if (rawSymbol.startsWith('LD') && rawSymbol.length > 2) {
                const mappedSymbol = rawSymbol.slice(2);
                ldSpotCandidates.set(
                  mappedSymbol,
                  (ldSpotCandidates.get(mappedSymbol) || 0) + qty,
                );
                continue;
              }

              positions.push({
                symbol: rawSymbol,
                amount: qty,
                value_usd: 0,
                price: 0,
                exchange: 'Binance',
                type: 'spot',
                account: 'spot',
                realtime: true,
              });
            }
          }
        }
      } catch (error) {
        hadError = true;
        restricted = restricted || this.isRestrictedLocationError(error);
        lastError = lastError || error.message;
        this.logger.warn(`Binance ${mode} spot failed: ${error.message}`);
      }

      // Funding
      try {
        const funding = await binance.sapi_post_asset_get_funding_asset();
        for (const item of funding || []) {
          const qty = Number(item.free || 0) + Number(item.locked || 0);
          if (qty > 0.00000001) {
            positions.push({
              symbol: String(item.asset || '').toUpperCase(),
              amount: qty,
              value_usd: 0,
              price: 0,
              exchange: 'Binance',
              type: 'funding',
              account: 'funding',
              realtime: true,
            });
          }
        }
      } catch (error) {
        hadError = true;
        restricted = restricted || this.isRestrictedLocationError(error);
        lastError = lastError || error.message;
        this.logger.warn(`Binance ${mode} funding failed: ${error.message}`);
      }

      // Earn (flexible)
      try {
        const earn = await binance.sapi_get_simple_earn_flexible_position({ size: 100 });
        for (const item of earn?.rows || []) {
          const qty = Number(item.totalAmount || 0);
          if (qty > 0.00000001) {
            const symbol = String(item.asset || '').toUpperCase();
            earnSymbols.add(symbol);
            positions.push({
              symbol,
              amount: qty,
              value_usd: 0,
              price: 0,
              exchange: 'Binance',
              type: 'earn',
              account: 'earn',
              realtime: true,
            });
          }
        }
      } catch (error) {
        hadError = true;
        restricted = restricted || this.isRestrictedLocationError(error);
        lastError = lastError || error.message;
        this.logger.warn(`Binance ${mode} earn failed: ${error.message}`);
      }

      // Earn (locked)
      try {
        const earnLocked = await binance.sapi_get_simple_earn_locked_position({ size: 100 });
        for (const item of earnLocked?.rows || []) {
          const qty = Number(item.amount || item.totalAmount || item.holdingAmount || 0);
          if (qty > 0.00000001) {
            const symbol = String(item.asset || '').toUpperCase();
            earnSymbols.add(symbol);
            positions.push({
              symbol,
              amount: qty,
              value_usd: 0,
              price: 0,
              exchange: 'Binance',
              type: 'earn',
              account: 'earn-locked',
              realtime: true,
            });
          }
        }
      } catch (error) {
        hadError = true;
        restricted = restricted || this.isRestrictedLocationError(error);
        lastError = lastError || error.message;
        this.logger.warn(`Binance ${mode} locked earn failed: ${error.message}`);
      }

      // LD* spot balances are frequently Earn wrappers
      for (const [symbol, qty] of ldSpotCandidates.entries()) {
        if (qty <= 0.00000001 || earnSymbols.has(symbol)) {
          continue;
        }

        positions.push({
          symbol,
          amount: qty,
          value_usd: 0,
          price: 0,
          exchange: 'Binance',
          type: 'earn',
          account: 'earn-ld-spot',
          realtime: true,
        });
      }

      // Futures
      try {
        const binanceFutures = new ccxt.binance({
          apiKey,
          secret,
          enableRateLimit: true,
          options: { defaultType: 'future' },
          ...proxyOptions,
        });

        const acc = await binanceFutures.fapiPrivateV2GetAccount();
        for (const asset of acc?.assets || []) {
          const qty = Number(asset.walletBalance || 0);
          if (qty > 0.00000001) {
            positions.push({
              symbol: String(asset.asset || '').toUpperCase(),
              amount: qty,
              value_usd: 0,
              price: 0,
              exchange: 'Binance',
              type: 'futures',
              account: 'futures',
              realtime: true,
            });
          }
        }
      } catch (error) {
        hadError = true;
        restricted = restricted || this.isRestrictedLocationError(error);
        lastError = lastError || error.message;
        this.logger.warn(`Binance ${mode} futures failed: ${error.message}`);
      }

      await this.enrichWithPrices(positions, binancePublic);
      return {
        positions: this.filterDust(positions),
        restricted,
        hadError,
        lastError: lastError || undefined,
      };
    };

    const configuredProxy = this.getProxyUrl();
    let aggregateRestricted = false;
    let aggregateHadError = false;
    let aggregateLastError = '';

    if (configuredProxy) {
      const proxied = await fetchByMode(configuredProxy, 'proxy');
      aggregateRestricted = aggregateRestricted || proxied.restricted;
      aggregateHadError = aggregateHadError || proxied.hadError;
      aggregateLastError = aggregateLastError || proxied.lastError || '';
      if (proxied.positions.length > 0) {
        return proxied;
      }
    }

    const direct = await fetchByMode(null, 'direct');
    aggregateRestricted = aggregateRestricted || direct.restricted;
    aggregateHadError = aggregateHadError || direct.hadError;
    aggregateLastError = aggregateLastError || direct.lastError || '';
    if (direct.positions.length > 0) {
      return direct;
    }

    if (direct.restricted && !configuredProxy) {
      const fallbackProxy = 'http://127.0.0.1:7890';
      const proxiedFallback = await fetchByMode(fallbackProxy, 'proxy-7890');
      aggregateRestricted = aggregateRestricted || proxiedFallback.restricted;
      aggregateHadError = aggregateHadError || proxiedFallback.hadError;
      aggregateLastError = aggregateLastError || proxiedFallback.lastError || '';
      if (proxiedFallback.positions.length > 0) {
        this.logger.log(`Binance recovered via local proxy ${fallbackProxy}`);
        return proxiedFallback;
      }
    }

    return {
      positions: [],
      restricted: aggregateRestricted,
      hadError: aggregateHadError,
      lastError: aggregateLastError || undefined,
    };
  }

  private loadBinanceSnapshotFallback(): CryptoPosition[] {
    const candidates = [
      path.resolve(__dirname, '../../../../data/binance-fallback.json'),
      path.join(process.cwd(), '..', 'data', 'binance-fallback.json'),
      path.resolve(__dirname, '../../../../wealth-dashboard/data/history.jsonl'),
      path.resolve(__dirname, '../../../../wealth-dashboard/data.json'),
      path.join(process.cwd(), '..', '..', 'wealth-dashboard', 'data', 'history.jsonl'),
      path.join(process.cwd(), '..', '..', 'wealth-dashboard', 'data.json'),
      path.join(process.cwd(), '..', 'wealth-dashboard', 'data', 'history.jsonl'),
      path.join(process.cwd(), '..', 'wealth-dashboard', 'data.json'),
    ];

    for (const candidate of candidates) {
      if (!fs.existsSync(candidate)) {
        continue;
      }

      try {
        const raw = fs.readFileSync(candidate, 'utf8').trim();
        if (!raw) {
          continue;
        }

        let parsed: any = null;
        if (candidate.endsWith('.jsonl')) {
          const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
          if (lines.length === 0) {
            continue;
          }
          parsed = JSON.parse(lines[lines.length - 1]);
        } else {
          parsed = JSON.parse(raw);
        }

        const holdings = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.crypto?.holdings)
            ? parsed.crypto.holdings
            : Array.isArray(parsed?.holdings)
              ? parsed.holdings
              : [];

        const positions: CryptoPosition[] = [];
        for (const item of holdings) {
          const source = String(item?.source || '');
          if (!source.toLowerCase().includes('binance')) {
            continue;
          }

          const symbol = String(item?.symbol || '').toUpperCase();
          const amount = Number(item?.qty ?? item?.amount ?? 0);
          const valueUsd = Number(item?.value_usd || 0);
          if (!symbol || amount <= 0.00000001 || valueUsd < 1) {
            continue;
          }

          const sourceLower = source.toLowerCase();
          let type: CryptoPosition['type'] = 'spot';
          if (sourceLower.includes('futures')) {
            type = 'futures';
          } else if (sourceLower.includes('funding')) {
            type = 'funding';
          } else if (sourceLower.includes('earn')) {
            type = 'earn';
          }

          const accountMatch = source.match(/\(([^)]+)\)/);
          const account = accountMatch ? `${accountMatch[1].toLowerCase()}-snapshot` : `${type}-snapshot`;

          positions.push({
            symbol,
            amount,
            value_usd: valueUsd,
            price: Number(item?.price || 0),
            exchange: 'Binance',
            type,
            account,
            realtime: false,
          });
        }

        if (positions.length > 0) {
          this.logger.warn(
            `Binance realtime unavailable, fallback to local snapshot: ${candidate} (${positions.length} positions)`,
          );
          return this.filterDust(positions);
        }
      } catch (error) {
        this.logger.warn(`Failed to parse Binance fallback snapshot ${candidate}: ${error.message}`);
      }
    }

    return [];
  }


  private async getBitgetData(): Promise<CryptoPosition[]> {
    const apiKey = this.secrets.bitget?.apiKey || '';
    const secret = this.secrets.bitget?.secret || '';
    const password = this.secrets.bitget?.password || '';

    if (!apiKey || !secret) {
      return [];
    }

    try {
      const bitget = new (ccxt as any).bitget({
        apiKey,
        secret,
        password,
        enableRateLimit: true,
      });

      const positions: CryptoPosition[] = [];

      // Spot 账户
      try {
        const balance = await bitget.fetchBalance({ type: 'spot' });
        for (const [coin, info] of Object.entries(balance.total as Record<string, number>)) {
          if (!info || info <= 0) continue;
          const symbol = `${coin}/USDT`;
          let valueUsd = 0;
          try {
            if (coin === 'USDT' || coin === 'USDC') {
              valueUsd = info;
            } else {
              const ticker = await bitget.fetchTicker(symbol);
              valueUsd = info * (ticker.last || 0);
            }
          } catch { valueUsd = 0; }
          if (valueUsd < 0.01) continue;
          positions.push({
            symbol: coin,
            amount: info,
            value_usd: valueUsd,
            price: valueUsd / info,
            exchange: 'Bitget',
            type: 'spot',
          });
        }
      } catch (e) {
        this.logger.warn(`Bitget spot error: ${e.message}`);
      }

      // 理财账户（earn）
      try {
        const earn = await bitget.fetchBalance({ type: 'savings' });
        for (const [coin, info] of Object.entries(earn.total as Record<string, number>)) {
          if (!info || info <= 0) continue;
          let valueUsd = 0;
          try {
            if (coin === 'USDT' || coin === 'USDC') {
              valueUsd = info;
            } else {
              const ticker = await bitget.fetchTicker(`${coin}/USDT`);
              valueUsd = info * (ticker.last || 0);
            }
          } catch { valueUsd = 0; }
          if (valueUsd < 0.01) continue;
          positions.push({
            symbol: coin,
            amount: info,
            value_usd: valueUsd,
            price: valueUsd / info,
            exchange: 'Bitget',
            type: 'earn',
          });
        }
      } catch (e) {
        this.logger.warn(`Bitget earn error: ${e.message}`);
      }

      this.logger.log(`Bitget: ${positions.length} positions`);
      return positions;
    } catch (e) {
      this.logger.error(`Bitget error: ${e.message}`);
      this.ingestStatus.bitget = { source: 'none', hasCredentials: true, lastError: e.message };
      return [];
    }
  }

  private async getHyperliquidData(binancePublic: ccxt.binance): Promise<CryptoPosition[]> {
    const positions: CryptoPosition[] = [];
    const wallet = this.secrets.hyperliquid?.wallet;
    if (!wallet) {
      return positions;
    }

    try {
      const resp = await axios.post(
        'https://api.hyperliquid.xyz/info',
        { type: 'spotClearinghouseState', user: wallet },
        { timeout: 10000 },
      );
      for (const b of resp.data?.balances || []) {
        const amount = Number(b.total || 0);
        if (amount > 0.00000001) {
          positions.push({
            symbol: b.coin,
            amount,
            value_usd: 0,
            price: 0,
            exchange: 'Hyperliquid',
            type: 'spot',
            account: 'spot',
          });
        }
      }
    } catch (error) {
      this.logger.warn(`Hyperliquid fetch failed: ${error.message}`);
    }

    await this.enrichWithPrices(positions, binancePublic);
    return this.filterDust(positions);
  }

  getStatus(): CryptoIngestStatus {
    if (this.ingestStatus.updatedAt === 0) {
      const hasOkxApiKeys = Boolean(
        this.secrets.okx?.apiKey && this.secrets.okx?.secret && this.secrets.okx?.password,
      );
      const hasBinanceApiKeys = Boolean(this.secrets.binance?.apiKey && this.secrets.binance?.secret);
      const hasBitgetApiKeys = Boolean(this.secrets.bitget?.apiKey && this.secrets.bitget?.secret);

      const configuredToken = String(this.secrets.okx?.webToken || '').trim();
      const legacyToken = configuredToken ? '' : this.loadLegacyOkxToken();
      const tokenSource = configuredToken ? 'config' : legacyToken ? 'legacy' : 'none';

      return {
        okx: {
          source: tokenSource !== 'none' ? 'web' : hasOkxApiKeys ? 'v5' : 'none',
          tokenSource,
        },
        binance: {
          source: hasBinanceApiKeys ? 'api-key' : 'none',
          hasCredentials: hasBinanceApiKeys,
          lastError: undefined,
        },
        bitget: {
          source: hasBitgetApiKeys ? 'api-key' : 'none',
          hasCredentials: hasBitgetApiKeys,
          lastError: undefined,
        },
        updatedAt: 0,
      };
    }

    return {
      okx: { ...this.ingestStatus.okx },
      binance: { ...this.ingestStatus.binance },
      bitget: { ...this.ingestStatus.bitget },
      updatedAt: this.ingestStatus.updatedAt,
    };
  }

  async getAllPositions(): Promise<CryptoPosition[]> {
    const binancePublic = new ccxt.binance({ enableRateLimit: true });

    const hasOkxApiKeys = Boolean(
      this.secrets.okx?.apiKey && this.secrets.okx?.secret && this.secrets.okx?.password,
    );
    const hasBinanceApiKeys = Boolean(this.secrets.binance?.apiKey && this.secrets.binance?.secret);
    const hasBitgetApiKeys = Boolean(this.secrets.bitget?.apiKey && this.secrets.bitget?.secret);

    const okxWeb = await this.getOKXWebData(binancePublic);
    const okxPositions = okxWeb.length > 0 ? okxWeb : await this.getOKXV5Data(binancePublic);
    const [binanceResult, hyperliquidPositions, bitgetPositions] = await Promise.all([
      this.getBinanceData(),
      this.getHyperliquidData(binancePublic),
      this.getBitgetData(),
    ]);

    let binancePositions = binanceResult.positions;
    let binanceSource: 'api-key' | 'snapshot' | 'none' = hasBinanceApiKeys ? 'api-key' : 'none';

    if (hasBinanceApiKeys && binancePositions.length === 0) {
      const snapshotFallback = this.loadBinanceSnapshotFallback();
      if (snapshotFallback.length > 0) {
        binancePositions = snapshotFallback;
        binanceSource = 'snapshot';
      } else {
        binanceSource = 'none';
      }
    }

    this.ingestStatus.okx.source = okxWeb.length > 0 ? 'web' : hasOkxApiKeys ? 'v5' : 'none';
    this.ingestStatus.binance = {
      source: binanceSource,
      hasCredentials: hasBinanceApiKeys,
      lastError:
        binanceSource === 'snapshot'
          ? 'Realtime Binance unavailable; using local snapshot fallback.'
          : binanceResult.lastError,
    };
    this.ingestStatus.updatedAt = Date.now();

    this.ingestStatus.bitget = { source: hasBitgetApiKeys ? 'api-key' : 'none', hasCredentials: hasBitgetApiKeys };
    const allPositions = [...okxPositions, ...binancePositions, ...hyperliquidPositions, ...bitgetPositions];
    await this.enrichWithPrices(allPositions, binancePublic);

    const totalValue = allPositions.reduce((sum, p) => sum + (p.value_usd || 0), 0);

    this.logger.log(`Total crypto: ${allPositions.length} positions, $${totalValue.toFixed(2)}`);
    return allPositions;
  }
}
