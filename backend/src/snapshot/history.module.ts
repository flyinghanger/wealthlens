import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Snapshot } from './snapshot.entity';
import { SnapshotService } from './snapshot.service';
import { HistoryController } from './history.controller';
import { AssetsModule } from '../assets/assets.module';
import { CryptoModule } from '../crypto/crypto.module';
import { ChainModule } from '../chain/chain.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Snapshot]),
    forwardRef(() => AssetsModule),
    forwardRef(() => CryptoModule),
    forwardRef(() => ChainModule),
  ],
  controllers: [HistoryController],
  providers: [SnapshotService],
  exports: [SnapshotService],
})
export class HistoryModule {}
