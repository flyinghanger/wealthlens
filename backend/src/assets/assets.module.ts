import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AssetsController } from './assets.controller';
import { SummaryController } from './summary.controller';
import { AssetsService } from './assets.service';
import { FutuModule } from '../futu/futu.module';
import { IbkrModule } from '../ibkr/ibkr.module';
import { RatesModule } from '../rates/rates.module';
import { MarketService } from '../market/market.service';

@Module({
  imports: [FutuModule, IbkrModule, HttpModule, RatesModule],
  controllers: [AssetsController, SummaryController],
  providers: [AssetsService, MarketService],
  exports: [AssetsService],
})
export class AssetsModule {}
