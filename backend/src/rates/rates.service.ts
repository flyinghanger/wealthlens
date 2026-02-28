import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface ExchangeRates {
  usd_to_cny: number;
  hkd_to_usd: number;
  updated_at: number;
  source: string;
}

const CURRENCYAPI_KEY = 'cur_live_95EvIPUKXyeGFXem4IGLmtrLliDsEz3w1K6lrxS7';
const EXCHANGERATE_KEY = '7a6df3b2e992ac98e03268d6';

@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name);
  private cachedRates: ExchangeRates | null = null;
  private lastFetchTime = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000;

  async getRates(): Promise<ExchangeRates> {
    const now = Date.now();
    if (this.cachedRates && now - this.lastFetchTime < this.CACHE_TTL) {
      return this.cachedRates;
    }

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
        this.cachedRates = { usd_to_cny: usdToCny, hkd_to_usd: 1 / usdToHkd, updated_at: now, source: 'currencyapi.com' };
        this.lastFetchTime = now;
        this.logger.log(`FX from currencyapi.com: USD/CNY=${usdToCny.toFixed(4)}, HKD/USD=${(1/usdToHkd).toFixed(6)}`);
        return this.cachedRates;
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
        this.cachedRates = { usd_to_cny: usdToCny, hkd_to_usd: 1 / usdToHkd, updated_at: now, source: 'exchangerate-api.com' };
        this.lastFetchTime = now;
        this.logger.log(`FX from exchangerate-api.com: USD/CNY=${usdToCny.toFixed(4)}`);
        return this.cachedRates;
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
        this.cachedRates = { usd_to_cny: usdToCny, hkd_to_usd: 1 / usdToHkd, updated_at: now, source: 'open.er-api.com' };
        this.lastFetchTime = now;
        this.logger.log(`FX from open.er-api.com: USD/CNY=${usdToCny.toFixed(4)}`);
        return this.cachedRates;
      }
    } catch (e) {
      this.logger.warn(`open.er-api.com failed: ${e.message}`);
    }

    // 4. 兜底固定值
    this.logger.warn('All FX sources failed, using hardcoded fallback');
    this.cachedRates = { usd_to_cny: 7.25, hkd_to_usd: 0.1285, updated_at: now, source: 'fallback' };
    this.lastFetchTime = now;
    return this.cachedRates;
  }
}
