import { Controller, Get, Param } from '@nestjs/common';
import { ChainService } from './chain.service';

@Controller('api/chain')
export class ChainController {
  constructor(private readonly chainService: ChainService) {}

  @Get('health')
  async health() {
    return { status: 'ok', service: 'chain' };
  }

  @Get()
  async getAllChainBalances() {
    return this.chainService.getAllChainBalances();
  }

  @Get(':chainKey')
  async getChainAssets(@Param('chainKey') chainKey: string) {
    return this.chainService.getChainAssets(chainKey);
  }
}
