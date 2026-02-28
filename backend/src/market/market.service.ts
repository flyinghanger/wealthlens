import { Injectable, Logger } from '@nestjs/common';
import { toFiniteNumber } from '../common/market-change.util';

interface YahooQuote {
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
  previousClose?: number;
  postMarketPrice?: number;
  preMarketPrice?: number;
}

interface YahooFinanceClient {
  quote(symbol: string): Promise<YahooQuote>;
}

export interface Stock24hChange {
  code: string;
  yahooSymbol: string;
  currentPrice: number;
  previousClose: number;
  price_change_24h_percent: number;
}

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);
  private yahooClientPromise: Promise<YahooFinanceClient | null> | null = null;

  async getStocks24hChanges(
    codes: string[],
  ): Promise<Map<string, Stock24hChange>> {
    const changes = new Map<string, Stock24hChange>();
    const uniqueCodes = Array.from(
      new Set(
        codes.map((code) => code.trim()).filter((code) => code.length > 0),
      ),
    );

    if (uniqueCodes.length === 0) {
      return changes;
    }

    const client = await this.getYahooClient();
    if (!client) {
      return changes;
    }

    const responses = await Promise.all(
      uniqueCodes.map((code) => this.fetchStock24hChange(code, client)),
    );
    for (const response of responses) {
      if (response) {
        changes.set(response.code, response);
      }
    }

    return changes;
  }

  toYahooSymbol(code: string): string | null {
    const normalizedCode = String(code || '')
      .trim()
      .toUpperCase();
    if (!normalizedCode) {
      return null;
    }

    const dotIndex = normalizedCode.indexOf('.');
    if (dotIndex < 0) {
      return normalizedCode;
    }

    const market = normalizedCode.slice(0, dotIndex);
    const rawSymbol = normalizedCode.slice(dotIndex + 1);

    if (!rawSymbol) {
      return null;
    }

    if (market === 'US') {
      return rawSymbol.replace(/\./g, '-');
    }

    if (market === 'HK') {
      const digits = rawSymbol.replace(/\D/g, '');
      if (!digits) {
        return null;
      }

      const parsed = Number.parseInt(digits, 10);
      if (!Number.isFinite(parsed)) {
        return null;
      }

      return String(parsed).padStart(4, '0') + '.HK';
    }

    if (market === 'SH' || market === 'SZ') {
      const digits = rawSymbol.replace(/\D/g, '');
      if (digits.length !== 6) {
        return null;
      }

      return digits + '.' + (market === 'SH' ? 'SS' : 'SZ');
    }

    return null;
  }

  protected async loadYahooClient(): Promise<YahooFinanceClient | null> {
    try {
      // 使用 require 方式导入并实例化（v2+ 需要 new）
      const YahooFinanceConstructor = require('yahoo-finance2').default;
      const yahooFinance = new YahooFinanceConstructor();
      
      if (
        yahooFinance &&
        typeof yahooFinance === 'object' &&
        'quote' in yahooFinance &&
        typeof yahooFinance.quote === 'function'
      ) {
        this.logger.log('yahoo-finance2 initialized successfully');
        return yahooFinance as YahooFinanceClient;
      }

      this.logger.warn('yahoo-finance2 loaded, but quote API is unavailable');
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        'yahoo-finance2 unavailable, skip stocks 24h quote fetch: ' + message,
      );
      return null;
    }
  }

  private async getYahooClient(): Promise<YahooFinanceClient | null> {
    if (!this.yahooClientPromise) {
      this.yahooClientPromise = this.loadYahooClient();
    }

    return this.yahooClientPromise;
  }

  private async fetchStock24hChange(
    code: string,
    client: YahooFinanceClient,
  ): Promise<Stock24hChange | null> {
    const yahooSymbol = this.toYahooSymbol(code);
    if (!yahooSymbol) {
      return null;
    }

    try {
      const quote = await client.quote(yahooSymbol);
      const currentPrice =
        toFiniteNumber(quote.regularMarketPrice, 0) ||
        toFiniteNumber(quote.postMarketPrice, 0) ||
        toFiniteNumber(quote.preMarketPrice, 0);
      const previousClose =
        toFiniteNumber(quote.regularMarketPreviousClose, 0) ||
        toFiniteNumber(quote.previousClose, 0);

      if (currentPrice <= 0 || previousClose <= 0) {
        return null;
      }

      return {
        code,
        yahooSymbol,
        currentPrice,
        previousClose,
        price_change_24h_percent:
          ((currentPrice - previousClose) / previousClose) * 100,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        'Failed to fetch 24h quote for ' +
          code +
          ' (' +
          yahooSymbol +
          '): ' +
          message,
      );
      return null;
    }
  }
}
