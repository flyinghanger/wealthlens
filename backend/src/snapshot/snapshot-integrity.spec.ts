import { mergeSnapshotWithFallback } from './snapshot-integrity';

describe('mergeSnapshotWithFallback', () => {
  it('uses previous snapshot data when realtime parts are missing', () => {
    const result = mergeSnapshotWithFallback({
      realtime: {
        stocksValue: 0,
        cashValue: 0,
        fundAssetsValue: 0,
        stocksPositions: [],
        cryptoPositions: [{ symbol: 'BTC', value_usd: 1000 }],
        chainAssets: [{ symbol: 'ETH', value_usd: 200 }],
        available: {
          stocks: false,
          cash: false,
          funds: false,
          crypto: true,
          chain: true,
        },
        missingReasons: {
          stocks: 'assets 接口失败',
          cash: 'assets 接口失败',
          funds: 'assets 接口失败',
        },
      },
      previousSnapshot: {
        stocksValue: 32000,
        cashValue: 50,
        fundAssetsValue: 69000,
        stocksPositions: [{ code: 'US.TEST' }],
      },
    });

    expect(result.stocksValue).toBe(32000);
    expect(result.cashValue).toBe(50);
    expect(result.fundAssetsValue).toBe(69000);
    expect(result.stocksPositions).toEqual([{ code: 'US.TEST' }]);
    expect(result.cryptoValue).toBe(1000);
    expect(result.chainValue).toBe(200);

    expect(result.dataIntegrity.used_historical_data).toBe(true);
    expect(result.dataIntegrity.used_historical_data_parts).toEqual(
      expect.arrayContaining(['stocks', 'cash', 'funds']),
    );
    expect(result.dataIntegrity.sources.stocks.state).toBe('fallback');
    expect(result.dataIntegrity.sources.crypto.state).toBe('realtime');
  });

  it('marks missing when realtime fails and no previous snapshot exists', () => {
    const result = mergeSnapshotWithFallback({
      realtime: {
        stocksValue: 0,
        cashValue: 0,
        fundAssetsValue: 0,
        stocksPositions: [],
        cryptoPositions: [],
        chainAssets: [],
        available: {
          stocks: false,
          cash: false,
          funds: false,
          crypto: false,
          chain: false,
        },
        missingReasons: {
          stocks: 'assets 不可用',
          cash: 'assets 不可用',
          funds: 'assets 不可用',
          crypto: 'crypto 不可用',
          chain: 'chain 不可用',
        },
      },
    });

    expect(result.dataIntegrity.used_historical_data).toBe(false);
    expect(result.dataIntegrity.sources.stocks.state).toBe('missing');
    expect(result.dataIntegrity.sources.cash.state).toBe('missing');
    expect(result.dataIntegrity.sources.funds.state).toBe('missing');
    expect(result.dataIntegrity.sources.crypto.state).toBe('missing');
    expect(result.dataIntegrity.sources.chain.state).toBe('missing');
    expect(result.dataIntegrity.warnings.length).toBeGreaterThanOrEqual(5);
  });
});
