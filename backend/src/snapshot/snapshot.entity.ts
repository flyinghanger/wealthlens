import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import type { SnapshotDataIntegrity } from './snapshot-integrity';

@Entity('snapshots')
export class Snapshot {
  @PrimaryGeneratedColumn()
  id!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @Index()
  @Column({ type: 'bigint' })
  timestamp!: number;

  @Column({ type: 'integer', default: 1 })
  formulaVersion!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  stocksValue!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  cashValue!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  fundAssetsValue!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  cryptoValue!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  chainValue!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  stocksBucketUsd!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  cryptoRiskBucketUsd!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  usdSavingsBucketUsd!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  cnyAssetsBucketUsd!: number;

  @Column({ type: 'simple-json', nullable: true })
  ratesSnapshot?: {
    usd_to_cny: number;
    hkd_to_usd: number;
    source?: string;
    rates_updated_at?: number;
    captured_at: number;
  };

  @Column({ type: 'simple-json', nullable: true })
  dataIntegrity?: SnapshotDataIntegrity;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  totalValue!: number;

  @Column({ type: 'simple-json', nullable: true })
  stocksPositions?: Array<{
    code: string;
    stock_name: string;
    qty: number;
    market_val: number;
    pl_val: number;
    pl_ratio: number;
    market_val_usd?: number;
    pl_val_usd?: number;
    price_change_24h_percent?: number;
    price_change_24h_value?: number;
  }>;

  @Column({ type: 'simple-json', nullable: true })
  cryptoPositions?: Array<{
    symbol: string;
    amount: number;
    value_usd: number;
    price: number;
    exchange: string;
    type: string;
    price_change_24h_percent?: number;
    price_change_24h_value?: number;
  }>;

  @Column({ type: 'simple-json', nullable: true })
  chainAssets?: Array<{
    chain: string;
    symbol: string;
    balance: number;
    value_usd: number;
    price: number;
    address?: string;
  }>;
}
