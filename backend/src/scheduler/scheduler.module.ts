import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SnapshotScheduler } from './snapshot.scheduler';
import { SnapshotService } from '../snapshot/snapshot.service';
import { Snapshot } from '../snapshot/snapshot.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Snapshot]),
  ],
  providers: [SnapshotScheduler, SnapshotService],
  exports: [SnapshotScheduler],
})
export class SchedulerModule {}
