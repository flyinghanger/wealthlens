import { Controller, Get } from '@nestjs/common';
import { AssetsService } from './assets.service';

@Controller('api/assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get('snapshot')
  async getSnapshot() {
    return this.assetsService.getSnapshot();
  }

  @Get('health')
  async getHealth() {
    return this.assetsService.checkHealth();
  }
}
