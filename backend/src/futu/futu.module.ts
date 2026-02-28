import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FutuClient } from './futu.client';

@Module({
  imports: [HttpModule],
  providers: [FutuClient],
  exports: [FutuClient],
})
export class FutuModule {}
