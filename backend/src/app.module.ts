import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AssetsModule } from './assets/assets.module';
import { CryptoModule } from './crypto/crypto.module';
import { ChainModule } from './chain/chain.module';
import { FeishuModule } from './feishu/feishu.module';
import { HistoryModule } from './snapshot/history.module';
import { Snapshot } from './snapshot/snapshot.entity';
import { SchedulerModule } from './scheduler/scheduler.module';
import { RatesModule } from './rates/rates.module';
import { MarketModule } from './market/market.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: '../data/wealth.db',
      entities: [Snapshot],
      synchronize: true, // 自动创建表（开发环境）
      logging: process.env.NODE_ENV !== 'production',
    }),
    AssetsModule,
    CryptoModule,
    ChainModule,
    FeishuModule,
    HistoryModule,
    SchedulerModule,
    RatesModule,
    MarketModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
