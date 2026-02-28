import { MarketController } from './market.controller';

describe('MarketController', () => {
  const assetsService = {
    getSnapshot: jest.fn(),
  };
  const cryptoService = {
    getAllPositions: jest.fn(),
  };

  let controller: MarketController;

  beforeEach(() => {
    assetsService.getSnapshot.mockReset();
    cryptoService.getAllPositions.mockReset();
    controller = new MarketController(assetsService as any, cryptoService as any);
  });

  it('returns stock 24h rows with per-share price', async () => {
    assetsService.getSnapshot.mockResolvedValue({
      stocks: {
        positions: [
          {
            code: 'US.MU',
            nominal_price: 102.34,
            currency: 'USD',
            market_val_usd: 9876.54,
            price_change_24h_percent: 1.23,
            price_change_24h_value: 120.12,
          },
        ],
      },
    });

    const result = await controller.getStocks24h();
    expect(result.count).toBe(1);
    expect(result.columns).toEqual([
      { field: 'code', label: '代码' },
      { field: 'share_price', label: '股价' },
      { field: 'price_change_24h_percent', label: '24h涨跌幅' },
      { field: 'price_change_24h_value', label: '24h涨跌额(USD)' },
    ]);
    expect(result.positions[0]).toEqual({
      code: 'US.MU',
      share_price: 102.34,
      currency: 'USD',
      price_change_24h_percent: 1.23,
      price_change_24h_value: 120.12,
    });
  });

  it('returns crypto 24h rows with per-coin price', async () => {
    cryptoService.getAllPositions.mockResolvedValue([
      {
        symbol: 'BTC',
        exchange: 'Binance',
        price: 68321.22,
        value_usd: 12000,
        price_change_24h_percent: -2.1,
        price_change_24h_value: -252,
      },
    ]);

    const result = await controller.getCrypto24h();
    expect(result.count).toBe(1);
    expect(result.columns).toEqual([
      { field: 'symbol', label: '币种' },
      { field: 'coin_price', label: '币价' },
      { field: 'price_change_24h_percent', label: '24h涨跌幅' },
      { field: 'price_change_24h_value', label: '24h涨跌额(USD)' },
    ]);
    expect(result.positions[0]).toEqual({
      symbol: 'BTC',
      exchange: 'Binance',
      coin_price: 68321.22,
      price_change_24h_percent: -2.1,
      price_change_24h_value: -252,
    });
  });
});
