import { Controller, Delete, Get, Logger, Post, Query } from '@nestjs/common';
import { SnapshotService } from './snapshot.service';
import { DEFAULT_DOMESTIC_USD, calculateSnapshotBuckets } from './snapshot-buckets';
import { mergeSnapshotWithFallback } from './snapshot-integrity';

interface FetchSourceResult<T = unknown> {
  source: string;
  ok: boolean;
  status: number | null;
  durationMs: number;
  data: T | null;
  error?: string;
}

@Controller('api/history')
export class HistoryController {
  private readonly logger = new Logger(HistoryController.name);

  constructor(private readonly snapshotService: SnapshotService) {}

  private toFiniteNumber(value: unknown): number {
    const num = Number(value ?? 0);
    return Number.isFinite(num) ? num : 0;
  }

  private async fetchJsonSource<T>(source: string, url: string): Promise<FetchSourceResult<T>> {
    const startedAt = Date.now();

    try {
      const response = await fetch(url);
      const durationMs = Date.now() - startedAt;

      if (!response.ok) {
        return {
          source,
          ok: false,
          status: response.status,
          durationMs,
          data: null,
          error: `HTTP ${response.status}`,
        };
      }

      try {
        const data = (await response.json()) as T;
        return {
          source,
          ok: true,
          status: response.status,
          durationMs,
          data,
        };
      } catch (error) {
        return {
          source,
          ok: false,
          status: response.status,
          durationMs,
          data: null,
          error: `Invalid JSON: ${error instanceof Error ? error.message : 'unknown parse error'}`,
        };
      }
    } catch (error) {
      return {
        source,
        ok: false,
        status: null,
        durationMs: Date.now() - startedAt,
        data: null,
        error: error instanceof Error ? error.message : 'request failed',
      };
    }
  }

  private logSourceStatus(result: FetchSourceResult) {
    if (result.ok) {
      this.logger.log(
        `[manual-snapshot-source] ${result.source}=ok status=${result.status} duration=${result.durationMs}ms`,
      );
      return;
    }

    this.logger.warn(
      `[manual-snapshot-source] ${result.source}=failed status=${result.status ?? 'n/a'} duration=${result.durationMs}ms reason=${result.error || 'unknown'}`,
    );
  }

  private buildMissingReason(source: FetchSourceResult, fallback: string): string {
    if (source.ok) {
      return fallback;
    }

    return `${fallback} (${source.error || `HTTP ${source.status ?? 'n/a'}`})`;
  }

  private toTrendSnapshot(snapshot: any) {
    const total = Number(snapshot.totalValue || 0);

    if (Number(snapshot.formulaVersion || 1) >= 2) {
      return {
        timestamp: snapshot.timestamp,
        total,
        stocks: Number(snapshot.stocksBucketUsd || 0),
        cryptoRisk: Number(snapshot.cryptoRiskBucketUsd || 0),
        usdSavings: Number(snapshot.usdSavingsBucketUsd || 0),
        cnyAssets: Number(snapshot.cnyAssetsBucketUsd || 0),
      };
    }

    const stocks = Number(snapshot.stocksValue || 0) + Number(snapshot.cashValue || 0);
    const usdSavings = DEFAULT_DOMESTIC_USD + Number(snapshot.fundAssetsValue || 0);
    const cryptoRisk = Number(snapshot.cryptoValue || 0) + Number(snapshot.chainValue || 0);
    const cnyAssets = Math.max(0, total - stocks - usdSavings - cryptoRisk);

    return {
      timestamp: snapshot.timestamp,
      total,
      stocks,
      cryptoRisk,
      usdSavings,
      cnyAssets,
    };
  }

  /**
   * 获取历史趋势数据
   * GET /api/history/trend?days=7
   */
  @Get('trend')
  async getTrend(@Query('days') days?: string) {
    const numDays = parseInt(days || '7', 10);

    if (numDays === 1) {
      const snapshots = await this.snapshotService.getTodaySnapshots();
      return {
        period: 'today',
        snapshots: snapshots.map((s) => this.toTrendSnapshot(s)),
      };
    }

    const snapshots = await this.snapshotService.getByTimeRange(
      Date.now() - numDays * 24 * 60 * 60 * 1000,
    );

    return {
      period: `${numDays}days`,
      snapshots: snapshots.map((s) => this.toTrendSnapshot(s)),
    };
  }

  /**
   * 获取资产分布饼图数据
   * GET /api/history/distribution
   */
  @Get('distribution')
  async getDistribution() {
    return this.snapshotService.getAssetDistribution();
  }

  /**
   * 获取最近快照
   * GET /api/history/latest
   */
  @Get('latest')
  async getLatest() {
    const snapshot = await this.snapshotService.getLatest();
    if (!snapshot) {
      return { error: 'No snapshot found' };
    }

    const buckets = this.toTrendSnapshot(snapshot);

    return {
      timestamp: snapshot.timestamp,
      total: snapshot.totalValue,
      buckets: {
        stocks: buckets.stocks,
        crypto_risk: buckets.cryptoRisk,
        usd_savings: buckets.usdSavings,
        cny_assets: buckets.cnyAssets,
      },
      stocks: {
        value: snapshot.stocksValue,
        positions: snapshot.stocksPositions,
      },
      cash: snapshot.cashValue,
      funds: snapshot.fundAssetsValue,
      crypto: {
        value: snapshot.cryptoValue,
        positions: snapshot.cryptoPositions,
      },
      chain: {
        value: snapshot.chainValue,
        assets: snapshot.chainAssets,
      },
      formula_version: snapshot.formulaVersion || 1,
      rates_snapshot: snapshot.ratesSnapshot || null,
      data_integrity: snapshot.dataIntegrity || null,
    };
  }

  /**
   * 获取最近 N 条快照记录
   * GET /api/history/recent?limit=24
   */
  @Get('recent')
  async getRecent(@Query('limit') limit?: string) {
    const numLimit = parseInt(limit || '24', 10);
    const snapshots = await this.snapshotService.getRecent(numLimit);

    return {
      count: snapshots.length,
      snapshots: snapshots.map((s) => ({
        timestamp: s.timestamp,
        total: s.totalValue,
      })),
    };
  }

  /**
   * 手动创建快照
   * POST /api/history/snapshot
   */
  @Post('snapshot')
  async createSnapshot() {
    try {
      const [assetsRes, cryptoRes, chainRes, feishuRes, ratesRes] = await Promise.all([
        this.fetchJsonSource<any>('assets', 'http://127.0.0.1:3001/api/assets/snapshot'),
        this.fetchJsonSource<any[]>('crypto', 'http://127.0.0.1:3001/api/crypto'),
        this.fetchJsonSource<any[]>('chain', 'http://127.0.0.1:3001/api/chain'),
        this.fetchJsonSource<any>('feishu', 'http://127.0.0.1:3001/api/feishu/latest'),
        this.fetchJsonSource<any>('rates', 'http://127.0.0.1:3001/api/rates'),
      ]);

      this.logSourceStatus(assetsRes);
      this.logSourceStatus(cryptoRes);
      this.logSourceStatus(chainRes);
      this.logSourceStatus(feishuRes);
      this.logSourceStatus(ratesRes);

      const latestSnapshot = await this.snapshotService.getLatest();

      let stocksValue = 0;
      let cashValue = 0;
      let fundAssetsValue = 0;
      let stocksPositions: any[] = [];
      let cryptoPositions: any[] = [];
      let chainAssets: any[] = [];
      let feishuData: any = null;
      let usdToCny = 7.25;
      let ratesSnapshot: {
        usd_to_cny: number;
        hkd_to_usd: number;
        source?: string;
        rates_updated_at?: number;
        captured_at: number;
      } | null = {
        usd_to_cny: 7.25,
        hkd_to_usd: 0.1285,
        source: 'snapshot-fallback',
        captured_at: Date.now(),
      };

      const available = {
        stocks: false,
        cash: false,
        funds: false,
        crypto: false,
        chain: false,
      };

      const missingReasons: Record<string, string> = {};

      if (assetsRes.ok && assetsRes.data) {
        const data = assetsRes.data;
        const stocksTotalRaw = data?.stocks?.totalValue;
        const stocksPositionsRaw = data?.stocks?.positions;
        const cashRaw = data?.funds?.cash_usd ?? data?.funds?.cash;
        const fundAssetsRaw = data?.funds?.fund_assets_usd ?? data?.funds?.fundAssets;

        if (stocksTotalRaw !== undefined || Array.isArray(stocksPositionsRaw)) {
          available.stocks = true;
          stocksValue = this.toFiniteNumber(stocksTotalRaw);
          stocksPositions = Array.isArray(stocksPositionsRaw) ? stocksPositionsRaw : [];
        } else {
          missingReasons.stocks = 'assets 快照缺少 stocks 字段';
        }

        if (cashRaw !== undefined && cashRaw !== null) {
          available.cash = true;
          cashValue = this.toFiniteNumber(cashRaw);
        } else {
          missingReasons.cash = 'assets 快照缺少 cash 字段';
        }

        if (fundAssetsRaw !== undefined && fundAssetsRaw !== null) {
          available.funds = true;
          fundAssetsValue = this.toFiniteNumber(fundAssetsRaw);
        } else {
          missingReasons.funds = 'assets 快照缺少 fund assets 字段';
        }
      } else {
        const reason = this.buildMissingReason(assetsRes, 'assets 快照不可用');
        missingReasons.stocks = reason;
        missingReasons.cash = reason;
        missingReasons.funds = reason;
      }

      if (cryptoRes.ok && Array.isArray(cryptoRes.data)) {
        available.crypto = true;
        cryptoPositions = cryptoRes.data;
      } else {
        missingReasons.crypto = this.buildMissingReason(cryptoRes, 'crypto 数据不可用');
      }

      if (chainRes.ok && Array.isArray(chainRes.data)) {
        available.chain = true;
        chainAssets = chainRes.data;
      } else {
        missingReasons.chain = this.buildMissingReason(chainRes, 'chain 数据不可用');
      }

      if (feishuRes.ok && feishuRes.data) {
        feishuData = feishuRes.data;
      }

      if (ratesRes.ok && ratesRes.data) {
        const rates = ratesRes.data;
        usdToCny = this.toFiniteNumber(rates?.usd_to_cny);
        ratesSnapshot = {
          usd_to_cny: usdToCny,
          hkd_to_usd: this.toFiniteNumber(rates?.hkd_to_usd),
          source: rates?.source ? String(rates.source) : undefined,
          rates_updated_at: this.toFiniteNumber(rates?.updated_at) || undefined,
          captured_at: Date.now(),
        };
      }

      const merged = mergeSnapshotWithFallback({
        realtime: {
          stocksValue,
          cashValue,
          fundAssetsValue,
          stocksPositions,
          cryptoPositions,
          chainAssets,
          available,
          missingReasons,
        },
        previousSnapshot: latestSnapshot,
      });

      const dataSourceSummary = Object.entries(merged.dataIntegrity.sources)
        .map(([source, status]) => `${source}:${status.state}`)
        .join(', ');
      this.logger.log(`[manual-snapshot-integrity] ${dataSourceSummary}`);

      if (merged.dataIntegrity.used_historical_data) {
        this.logger.warn(
          `[manual-snapshot-integrity] 使用历史数据 fallback: ${merged.dataIntegrity.used_historical_data_parts.join(', ')}`,
        );
      }

      for (const warning of merged.dataIntegrity.warnings) {
        this.logger.warn(`[manual-snapshot-integrity] ${warning}`);
      }

      const realtimeTotal = stocksValue + cashValue + fundAssetsValue;
      const mixedTotal =
        merged.stocksValue +
        merged.cashValue +
        merged.fundAssetsValue +
        merged.cryptoValue +
        merged.chainValue;

      const buckets = calculateSnapshotBuckets({
        stocksValue: merged.stocksValue,
        cashValue: merged.cashValue,
        fundAssetsValue: merged.fundAssetsValue,
        cryptoPositions: merged.cryptoPositions,
        chainAssets: merged.chainAssets,
        feishuData,
        usdToCny,
      });

      const snapshot = await this.snapshotService.createSnapshot({
        formulaVersion: 2,
        stocksValue: merged.stocksValue,
        cashValue: merged.cashValue,
        fundAssetsValue: merged.fundAssetsValue,
        cryptoValue: merged.cryptoValue,
        chainValue: merged.chainValue,
        stocksBucketUsd: buckets.stocksBucketUsd,
        cryptoRiskBucketUsd: buckets.cryptoRiskBucketUsd,
        usdSavingsBucketUsd: buckets.usdSavingsBucketUsd,
        cnyAssetsBucketUsd: buckets.cnyAssetsBucketUsd,
        ratesSnapshot: ratesSnapshot || undefined,
        dataIntegrity: merged.dataIntegrity,
        totalValue: buckets.totalValue,
        stocksPositions: merged.stocksPositions,
        cryptoPositions: merged.cryptoPositions,
        chainAssets: merged.chainAssets,
      });

      return {
        success: true,
        snapshot: {
          id: snapshot.id,
          timestamp: snapshot.timestamp,
          total: snapshot.totalValue,
          realtime_total: realtimeTotal,
          mixed_total: mixedTotal,
          buckets: {
            stocks: buckets.stocksBucketUsd,
            crypto_risk: buckets.cryptoRiskBucketUsd,
            usd_savings: buckets.usdSavingsBucketUsd,
            cny_assets: buckets.cnyAssetsBucketUsd,
          },
          formula_version: 2,
          rates_snapshot: ratesSnapshot,
          data_integrity: merged.dataIntegrity,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 删除指定日期的快照
   * DELETE /api/history/snapshot?date=2026-02-15
   */
  @Delete('snapshot')
  async deleteSnapshotByDate(@Query('date') dateStr: string) {
    try {
      const targetDate = new Date(dateStr);
      const count = await this.snapshotService.deleteByDate(targetDate);
      return { success: true, deleted: count, date: dateStr };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
