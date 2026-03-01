import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export interface ExchangeRates {
  usd_to_cny: number;
  hkd_to_usd: number;
  updated_at: number;
  source: string;
}

const CURRENCYAPI_KEY = 'cur_live_95EvIPUKXyeGFXem4IGLmtrLliDsEz3w1K6lrxS7';
const EXCHANGERATE_KEY = '7a6df3b2e992ac98e03268d6';
const CACHE_FILE = path.resolve(__dirname, '../../../data/rates-cache.json');
const API_TTL = 8 * 60 * 60 * 1000; // 8 hours - 外部 API 调用间隔
const HARDCODED_FALLBACK: ExchangeRates = {
  usd_to_cny: 7.25,
  hkd_to_usd: 0.1285,
  updated_at: 0,
  source: 'hardcoded',
};

@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name);
  private cachedRates: ExchangeRates | null = null;
  private lastApiFetchTime = 0;

  constructor() {
    this.loadDiskCache();
  }

  /** 启动时从磁盘读取上次缓存的汇率 */
  private loadDiskCache() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        if (data.usd_to_cny && data.hkd_to_usd) {
          this.cachedRates = data;
          this.lastApiFetchTime = data.updated_at || 0;
          this.logger.log(
            `Loaded cached rates from disk: USD/CNY=${data.usd_to_cny}, source=${data.source}, age=${Math.round((Date.now() - data.updated_at) / 3600000)}h`,
          );
        }
      }
    } catch (e) {
      this.logger.warn(`Failed to load rates cache: ${e.message}`);
    }
  }

  /** 写入磁盘缓存（重启后可用） */
  private saveDiskCache(rates: ExchangeRates) {
    try {
      const dir = path.dirname(CACHE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(CACHE_FILE, JSON.stringify(rates, null, 2));
    } catch (e) {
      this.logger.warn(`Failed to save rates cache: ${e.message}`);
    }
  }

  async getRates(): Promise<ExchangeRates> {
    const now = Date.now();

    // 8 小时内直接返回缓存，不调外部 API
    if (this.cachedRates && now - this.lastApiFetchTime < API_TTL) {
      return this.cachedRates;
    }

    // 超过 8 小时，尝试刷新
    const fresh = await this.fetchFromApis();
    if (fresh) {
      this.cachedRates = fresh;
      this.lastApiFetchTime = now;
      this.saveDiskCache(fresh);
      return fresh;
    }

    // 所有 API 失败，用内存/磁盘缓存（动态兜底值）
    if (this.cachedRates) {
      this.logger.warn(
        `All FX APIs failed, using cached rates (age=${Math.round((now - this.cachedRates.updated_at) / 3600000)}h)`,
      );
      this.lastApiFetchTime = now; // 避免每次请求都重试失败的 API
      return this.cachedRates;
    }

    // 最终兜底：硬编码值
    this.logger.warn('No cached rates available, using hardcoded fallback');
    return HARDCODED_FALLBACK;
  }

  /** 依次尝试 3 个 API 源 */
  private async fetchFromApis(): Promise<ExchangeRates | null> {
    const now = Date.now();

    // 1. currencyapi.com
    try {
      const r = await axios.get(
        `https://api.currencyapi.com/v3/latest?apikey=${CURRENCYAPI_KEY}&base_currency=USD&currencies=CNY,HKD`,
        { timeout: 5000 },
      );
      const data = r.data?.data || {};
      const usdToCny = Number(data.CNY?.value) || 0;
      const usdToHkd = Number(data.HKD?.value) || 0;
      if (usdToCny && usdToHkd) {
        this.logger.log(`FX from currencyapi.com: USD/CNY=${usdToCny.toFixed(4)}`);
        return { usd_to_cny: usdToCny, hkd_to_usd: 1 / usdToHkd, updated_at: now, source: 'currencyapi.com' };
      }
    } catch (e) {
      this.logger.warn(`currencyapi.com failed: ${e.message}`);
    }

    // 2. exchangerate-api.com
    try {
      const r = await axios.get(
        `https://v6.exchangerate-api.com/v6/${EXCHANGERATE_KEY}/latest/USD`,
        { timeout: 5000 },
      );
      const rates = r.data?.conversion_rates || {};
      const usdToCny = Number(rates.CNY) || 0;
      const usdToHkd = Number(rates.HKD) || 0;
      if (usdToCny && usdToHkd) {
        this.logger.log(`FX from exchangerate-api.com: USD/CNY=${usdToCny.toFixed(4)}`);
        return { usd_to_cny: usdToCny, hkd_to_usd: 1 / usdToHkd, updated_at: now, source: 'exchangerate-api.com' };
      }
    } catch (e) {
      this.logger.warn(`exchangerate-api.com failed: ${e.message}`);
    }

    // 3. open.er-api.com
    try {
      const r = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 5000 });
      const rates = r.data?.rates || {};
      const usdToCny = Number(rates.CNY) || 0;
      const usdToHkd = Number(rates.HKD) || 0;
      if (usdToCny && usdToHkd) {
        this.logger.log(`FX from open.er-api.com: USD/CNY=${usdToCny.toFixed(4)}`);
        return { usd_to_cny: usdToCny, hkd_to_usd: 1 / usdToHkd, updated_at: now, source: 'open.er-api.com' };
      }
    } catch (e) {
      this.logger.warn(`open.er-api.com failed: ${e.message}`);
    }

    return null;
  }
}
