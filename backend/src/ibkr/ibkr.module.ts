import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IbkrClient } from './ibkr.client';

@Module({
  imports: [HttpModule],
  providers: [IbkrClient],
  exports: [IbkrClient],
})
export class IbkrModule {}
