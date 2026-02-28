import { Controller, Get } from '@nestjs/common';
import { AssetsService } from '../assets/assets.service';
import { CryptoService } from '../crypto/crypto.service';

@Controller('api/market')
export class MarketController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly cryptoService: CryptoService,
  ) {}

  @Get('stocks/24h')
  async getStocks24h() {
    const snapshot = await this.assetsService.getSnapshot();
    const positions = snapshot.stocks?.positions || [];

    return {
      timestamp: Date.now(),
      count: positions.length,
      columns: [
        { field: 'code', label: '代码' },
        { field: 'share_price', label: '股价' },
        { field: 'price_change_24h_percent', label: '24h涨跌幅' },
        { field: 'price_change_24h_value', label: '24h涨跌额(USD)' },
      ],
      positions: positions.map((position: any) => ({
        code: position.code,
        // 日报波动表展示“股价（每股）”，不再用持仓市值。
        share_price: Number(position.nominal_price || 0),
        currency: String(position.currency || 'USD').toUpperCase(),
        price_change_24h_percent: Number(position.price_change_24h_percent || 0),
        price_change_24h_value: Number(position.price_change_24h_value || 0),
      })),
    };
  }

  @Get('crypto/24h')
  async getCrypto24h() {
    const positions = await this.cryptoService.getAllPositions();

    return {
      timestamp: Date.now(),
      count: positions.length,
      columns: [
        { field: 'symbol', label: '币种' },
        { field: 'coin_price', label: '币价' },
        { field: 'price_change_24h_percent', label: '24h涨跌幅' },
        { field: 'price_change_24h_value', label: '24h涨跌额(USD)' },
      ],
      positions: positions.map((position) => ({
        symbol: position.symbol,
        exchange: position.exchange,
        // 日报波动表展示“币价（每币）”，不再用总持仓市值。
        coin_price: Number(position.price || 0),
        price_change_24h_percent: Number(position.price_change_24h_percent || 0),
        price_change_24h_value: Number(position.price_change_24h_value || 0),
      })),
    };
  }
}
