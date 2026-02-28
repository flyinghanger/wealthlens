import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Snapshot } from './snapshot.entity';
import { DEFAULT_DOMESTIC_USD } from './snapshot-buckets';
import type { SnapshotDataIntegrity } from './snapshot-integrity';

@Injectable()
export class SnapshotService {
  private readonly logger = new Logger(SnapshotService.name);

  constructor(
    @InjectRepository(Snapshot)
    private readonly snapshotRepo: Repository<Snapshot>,
  ) {}

  /**
   * 创建新的快照
   */
  async createSnapshot(data: {
    formulaVersion?: number;
    stocksValue: number;
    cashValue: number;
    fundAssetsValue: number;
    cryptoValue: number;
    chainValue: number;
    stocksBucketUsd?: number;
    cryptoRiskBucketUsd?: number;
    usdSavingsBucketUsd?: number;
    cnyAssetsBucketUsd?: number;
    ratesSnapshot?: {
      usd_to_cny: number;
      hkd_to_usd: number;
      source?: string;
      rates_updated_at?: number;
      captured_at: number;
    };
    dataIntegrity?: SnapshotDataIntegrity;
    totalValue: number;
    stocksPositions?: any[];
    cryptoPositions?: any[];
    chainAssets?: any[];
  }): Promise<Snapshot> {
    const snapshot = this.snapshotRepo.create({
      timestamp: Date.now(),
      formulaVersion: data.formulaVersion ?? 1,
      ...data,
    });

    const saved = await this.snapshotRepo.save(snapshot);
    const fallbackTag = data.dataIntegrity?.used_historical_data
      ? `, fallback=${data.dataIntegrity.used_historical_data_parts.join(',')}`
      : '';
    this.logger.log(`Snapshot saved: total=${data.totalValue.toLocaleString()}${fallbackTag}`);
    return saved;
  }

  /**
   * 获取最新的快照
   */
  async getLatest(): Promise<Snapshot | null> {
    const snapshots = await this.snapshotRepo.find({
      order: { timestamp: 'DESC' },
      take: 1,
    });
    return snapshots.length > 0 ? snapshots[0] : null;
  }

  /**
    按时间范围获取快照
   */
  async getByTimeRange(startTime: number, endTime?: number): Promise<Snapshot[]> {
    const end = endTime || Date.now();
    return this.snapshotRepo.find({
      where: {
        timestamp: Between(startTime, end),
      },
      order: { timestamp: 'ASC' },
    });
  }

  /**
   * 获取最近 N 条快照
   */
  async getRecent(limit: number = 24): Promise<Snapshot[]> {
    return this.snapshotRepo.find({
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * 获取今日快照（用于趋势图）
   */
  async getTodaySnapshots(): Promise<Snapshot[]> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return this.snapshotRepo.find({
      where: {
        timestamp: MoreThanOrEqual(startOfDay.getTime()),
      },
      order: { timestamp: 'ASC' },
    });
  }

  /**
   * 获取最近7天每日快照（聚合）
   */
  async getWeeklyTrend(): Promise<Snapshot[]> {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const snapshots = await this.snapshotRepo.find({
      where: {
        timestamp: MoreThanOrEqual(sevenDaysAgo),
      },
      order: { timestamp: 'ASC' },
    });

    // 按天聚合，保留每天的第一条和最后一条
    const dailySnapshots: Snapshot[] = [];
    const seenDates = new Set<string>();

    for (const s of snapshots) {
      const dateKey = new Date(s.timestamp).toISOString().split('T')[0];
      if (!seenDates.has(dateKey)) {
        dailySnapshots.push(s);
        seenDates.add(dateKey);
      }
    }

    for (let i = snapshots.length - 1; i >= 0; i--) {
      const s = snapshots[i];
      const dateKey = new Date(s.timestamp).toISOString().split('T')[0];
      if (
        seenDates.has(dateKey) &&
        !dailySnapshots.find(
          (d) => new Date(d.timestamp).toISOString().split('T')[0] === dateKey && d.id !== s.id,
        )
      ) {
        // 已经在数组中，跳过
      } else if (seenDates.has(dateKey)) {
        const idx = dailySnapshots.findIndex(
          (d) => new Date(d.timestamp).toISOString().split('T')[0] === dateKey,
        );
        if (idx >= 0) {
          dailySnapshots[idx] = s;
        }
      }
    }

    return dailySnapshots.sort((a, b) => a.timestamp - b.timestamp);
  }

  private resolveBuckets(snapshot: Snapshot): {
    stocksUsd: number;
    cryptoRiskUsd: number;
    usdSavingsUsd: number;
    cnyAssetsUsd: number;
  } {
    if (Number(snapshot.formulaVersion || 1) >= 2) {
      return {
        stocksUsd: Number(snapshot.stocksBucketUsd || 0),
        cryptoRiskUsd: Number(snapshot.cryptoRiskBucketUsd || 0),
        usdSavingsUsd: Number(snapshot.usdSavingsBucketUsd || 0),
        cnyAssetsUsd: Number(snapshot.cnyAssetsBucketUsd || 0),
      };
    }

    const stocksUsd = Number(snapshot.stocksValue || 0) + Number(snapshot.cashValue || 0);
    const usdSavingsUsd = DEFAULT_DOMESTIC_USD + Number(snapshot.fundAssetsValue || 0);
    const cryptoRiskUsd = Number(snapshot.cryptoValue || 0) + Number(snapshot.chainValue || 0);
    const cnyAssetsUsd = Math.max(
      0,
      Number(snapshot.totalValue || 0) - stocksUsd - usdSavingsUsd - cryptoRiskUsd,
    );

    return {
      stocksUsd,
      cryptoRiskUsd,
      usdSavingsUsd,
      cnyAssetsUsd,
    };
  }

  /**
   * 获取资产分布（用于饼图）
   */
  async getAssetDistribution(): Promise<{
    labels: string[];
    values: number[];
    percentages: number[];
  }> {
    const latest = await this.getLatest();

    const labels = ['Stocks', 'Crypto (Risk)', 'USD Savings', 'CNY Assets'];

    if (!latest) {
      return {
        labels,
        values: [0, 0, 0, 0],
        percentages: [0, 0, 0, 0],
      };
    }

    const buckets = this.resolveBuckets(latest);
    const values = [
      buckets.stocksUsd,
      buckets.cryptoRiskUsd,
      buckets.usdSavingsUsd,
      buckets.cnyAssetsUsd,
    ];

    const total = values.reduce((a, b) => a + b, 0);
    const percentages =
      total > 0 ? values.map((v) => parseFloat(((v / total) * 100).toFixed(1))) : [0, 0, 0, 0];

    return { labels, values, percentages };
  }

  /**
   * 删除旧快照（保留最近90天）
   */
  async cleanupOldSnapshots(): Promise<number> {
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const result = await this.snapshotRepo.delete({
      timestamp: LessThanOrEqual(ninetyDaysAgo),
    });

    if (result.affected && result.affected > 0) {
      this.logger.log(`Cleaned up ${result.affected} old snapshots`);
    }
    return result.affected || 0;
  }

  /**
   * 删除指定日期的快照
   */
  async deleteByDate(targetDate: Date): Promise<number> {
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await this.snapshotRepo.delete({
      timestamp: Between(startOfDay.getTime(), endOfDay.getTime()),
    });

    if (result.affected && result.affected > 0) {
      this.logger.log(`Deleted ${result.affected} snapshots from ${targetDate.toISOString().split('T')[0]}`);
    }
    return result.affected || 0;
  }
}
