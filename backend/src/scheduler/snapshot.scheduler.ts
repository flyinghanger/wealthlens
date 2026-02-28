import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SnapshotService } from '../snapshot/snapshot.service';
import { calculateSnapshotBuckets } from '../snapshot/snapshot-buckets';
import { mergeSnapshotWithFallback } from '../snapshot/snapshot-integrity';

interface FetchSourceResult<T = unknown> {
  source: string;
  ok: boolean;
  status: number | null;
  durationMs: number;
  data: T | null;
  error?: string;
}

@Injectable()
export class SnapshotScheduler {
  private readonly logger = new Logger(SnapshotScheduler.name);
  private cryptoService: any;
  private chainService: any;

  constructor(
    @Inject(forwardRef(() => SnapshotService))
    private readonly snapshotService: SnapshotService,
  ) {}

  /**
   * 设置外部服务引用（解决循环依赖）
   */
  setServices(cryptoService: any, chainService: any) {
    this.cryptoService = cryptoService;
    this.chainService = chainService;
  }

  private async runScheduledSnapshot(jobName: string, cleanup: boolean = false) {
    try {
      this.logger.log(`[${jobName}] Snapshot job triggered`);
      await this.createAndSaveSnapshot();

      if (cleanup) {
        await this.snapshotService.cleanupOldSnapshots();
      }
    } catch (error) {
      this.logger.error(`[${jobName}] Snapshot job failed`, error);
    }
  }

  /**
   * 每天第一次快照（默认 06:00）
   * 可通过 SNAPSHOT_CRON_1 覆盖，例如：0 9 * * *
   */
  @Cron(process.env.SNAPSHOT_CRON_1 || '0 6 * * *')
  async saveSnapshotCron1() {
    await this.runScheduledSnapshot('cron-1', true);
  }

  /**
   * 每天第二次快照（默认 20:00）
   * 可通过 SNAPSHOT_CRON_2 覆盖，例如：0 21 * * *
   */
  @Cron(process.env.SNAPSHOT_CRON_2 || '0 20 * * *')
  async saveSnapshotCron2() {
    await this.runScheduledSnapshot('cron-2');
  }

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
        `[snapshot-source] ${result.source}=ok status=${result.status} duration=${result.durationMs}ms`,
      );
      return;
    }

    this.logger.warn(
      `[snapshot-source] ${result.source}=failed status=${result.status ?? 'n/a'} duration=${result.durationMs}ms reason=${result.error || 'unknown'}`,
    );
  }

  private buildMissingReason(source: FetchSourceResult, fallback: string): string {
    if (source.ok) {
      return fallback;
    }

    return `${fallback} (${source.error || `HTTP ${source.status ?? 'n/a'}`})`;
  }

  /**
   * 创建并保存快照的统一方法
   */
  private async createAndSaveSnapshot() {
    const timestamp = Date.now();
    this.logger.log(`Creating snapshot at ${new Date(timestamp).toISOString()}`);

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
    let usdToCny = 0;
    let ratesSnapshot: {
      usd_to_cny: number;
      hkd_to_usd: number;
      source?: string;
      rates_updated_at?: number;
      captured_at: number;
    } | null = null;

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
    this.logger.log(`[snapshot-integrity] ${dataSourceSummary}`);

    if (merged.dataIntegrity.used_historical_data) {
      this.logger.warn(
        `[snapshot-integrity] 使用历史数据 fallback: ${merged.dataIntegrity.used_historical_data_parts.join(', ')}`,
      );
    }

    for (const warning of merged.dataIntegrity.warnings) {
      this.logger.warn(`[snapshot-integrity] ${warning}`);
    }

    const buckets = calculateSnapshotBuckets({
      stocksValue: merged.stocksValue,
      cashValue: merged.cashValue,
      fundAssetsValue: merged.fundAssetsValue,
      cryptoPositions: merged.cryptoPositions,
      chainAssets: merged.chainAssets,
      feishuData,
      usdToCny,
    });

    await this.snapshotService.createSnapshot({
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
  }
}
