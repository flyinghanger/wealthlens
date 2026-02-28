import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { CryptoModule } from '../crypto/crypto.module';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';

@Module({
  imports: [AssetsModule, CryptoModule],
  controllers: [MarketController],
  providers: [MarketService],
  exports: [MarketService],
})
export class MarketModule {}
