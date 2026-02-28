import { MarketService } from './market.service';

interface TestQuote {
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
  previousClose?: number;
  postMarketPrice?: number;
  preMarketPrice?: number;
}

interface TestYahooClient {
  quote: jest.Mock<Promise<TestQuote>, [string]>;
}

class TestableMarketService extends MarketService {
  constructor(private readonly client: TestYahooClient | null) {
    super();
  }

  protected async loadYahooClient() {
    if (!this.client) {
      return null;
    }

    return this.client as unknown as {
      quote(symbol: string): Promise<TestQuote>;
    };
  }
}

describe('MarketService', () => {
  it('converts Futu symbols to Yahoo symbols', () => {
    const service = new TestableMarketService(null);

    expect(service.toYahooSymbol('US.MU')).toBe('MU');
    expect(service.toYahooSymbol('US.BRK.B')).toBe('BRK-B');
    expect(service.toYahooSymbol('HK.00700')).toBe('0700.HK');
    expect(service.toYahooSymbol('HK.09988')).toBe('9988.HK');
    expect(service.toYahooSymbol('SH.600519')).toBe('600519.SS');
    expect(service.toYahooSymbol('SZ.000001')).toBe('000001.SZ');
    expect(service.toYahooSymbol('')).toBeNull();
  });

  it('fetches 24h changes and de-duplicates symbols', async () => {
    const client: TestYahooClient = {
      quote: jest.fn(async () => ({
        regularMarketPrice: 110,
        regularMarketPreviousClose: 100,
      })),
    };
    const service = new TestableMarketService(client);

    const changes = await service.getStocks24hChanges(['US.MU', 'US.MU']);

    expect(client.quote).toHaveBeenCalledTimes(1);
    expect(client.quote).toHaveBeenCalledWith('MU');
    expect(changes.get('US.MU')?.price_change_24h_percent).toBeCloseTo(10, 6);
  });

  it('falls back to post market price and previousClose', async () => {
    const client: TestYahooClient = {
      quote: jest.fn(async () => ({
        postMarketPrice: 95,
        previousClose: 100,
      })),
    };
    const service = new TestableMarketService(client);

    const changes = await service.getStocks24hChanges(['US.MU']);

    expect(changes.get('US.MU')?.price_change_24h_percent).toBeCloseTo(-5, 6);
  });

  it('skips symbols with invalid quote payload', async () => {
    const client: TestYahooClient = {
      quote: jest.fn(async () => ({
        regularMarketPrice: 0,
        regularMarketPreviousClose: 100,
      })),
    };
    const service = new TestableMarketService(client);

    const changes = await service.getStocks24hChanges([
      'US.MU',
      'UNKNOWN.CODE',
    ]);

    expect(changes.size).toBe(0);
    expect(client.quote).toHaveBeenCalledTimes(1);
  });
});
