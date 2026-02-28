import { Controller, Get } from '@nestjs/common';
import { CryptoService } from './crypto.service';

@Controller('api/crypto')
export class CryptoController {
  constructor(private readonly cryptoService: CryptoService) {}

  @Get()
  async getAllPositions() {
    return this.cryptoService.getAllPositions();
  }

  @Get('okx')
  async getOKXPositions() {
    const all = await this.cryptoService.getAllPositions();
    return all.filter(p => p.exchange === 'OKX');
  }

  @Get('binance')
  async getBinancePositions() {
    const all = await this.cryptoService.getAllPositions();
    return all.filter(p => p.exchange === 'Binance');
  }

  @Get('hyperliquid')
  async getHyperliquidPositions() {
    const all = await this.cryptoService.getAllPositions();
    return all.filter(p => p.exchange === 'Hyperliquid');
  }

  @Get('health')
  async health() {
    return {
      status: 'ok',
      service: 'crypto',
      ingest: this.cryptoService.getStatus(),
    };
  }
}
