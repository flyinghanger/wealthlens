declare module 'ccxt' {
  export class Exchange {
    enableRateLimit: boolean;
    fetchBalance(): Promise<any>;
    fetchTicker(symbol: string): Promise<any>;
    fetch_ticker(symbol: string): Promise<any>;
    fetchPositions(): Promise<any>;
  }

  export class okx extends Exchange {
    constructor(config: {
      apiKey?: string;
      secret?: string;
      password?: string;
      enableRateLimit?: boolean;
    });
    private_get_asset_balances(params?: any): Promise<any>;
    private_get_finance_savings_balance(params?: any): Promise<any>;
    private_get_asset_asset_valuation(params?: any): Promise<any>;
  }

  export class binance extends Exchange {
    constructor(config: {
      apiKey?: string;
      secret?: string;
      enableRateLimit?: boolean;
      options?: { defaultType?: string };
    });
    sapi_post_asset_get_funding_asset(): Promise<any>;
    sapi_get_simple_earn_flexible_position(params?: any): Promise<any>;
    sapi_get_simple_earn_locked_position(params?: any): Promise<any>;
    fapiPrivateV2GetAccount(): Promise<any>;
  }

  export class hyperliquid extends Exchange {
    constructor(config: {
      walletAddress: string;
      enableRateLimit?: boolean;
    });
  }
}
