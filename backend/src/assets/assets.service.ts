import { Injectable } from '@nestjs/common';
import {
  calculate24hChangeValue,
  toFiniteNumber,
} from '../common/market-change.util';
import { FutuClient, FutuPosition } from '../futu/futu.client';
import { IbkrClient, IbkrPosition } from '../ibkr/ibkr.client';
import { MarketService } from '../market/market.service';
import { RatesService } from '../rates/rates.service';

type PositionWithUSD = (FutuPosition | IbkrPosition) & {
  market_val_usd: number;
  pl_val_usd: number;
  price_change_24h_percent: number;
  price_change_24h_value: number;
  source: 'futu' | 'ibkr';
};

@Injectable()
export class AssetsService {
  constructor(
    private readonly futuClient: FutuClient,
    private readonly ibkrClient: IbkrClient,
    private readonly ratesService: RatesService,
    private readonly marketService: MarketService,
  ) {}

  private convertToUsd(
    position: FutuPosition | IbkrPosition,
    hkdToUsd: number,
    usdToCny: number,
    stock24hChangeMap: Map<string, any>,
  ): PositionWithUSD & { source: 'futu' | 'ibkr' } {
    let valueUsd = position.market_val;
    let plUsd = position.pl_val;

    if (position.currency === 'HKD') {
      valueUsd = position.market_val * hkdToUsd;
      plUsd = position.pl_val * hkdToUsd;
    } else if (position.currency === 'CNY') {
      valueUsd = position.market_val / usdToCny;
      plUsd = position.pl_val / usdToCny;
    }

    const marketQuoteChange = stock24hChangeMap.get(position.code);
    const priceChangePercent = toFiniteNumber(
      marketQuoteChange?.price_change_24h_percent ??
        position.price_change_24h_percent,
      0,
    );
    const priceChangeValueUsd = calculate24hChangeValue(
      valueUsd,
      priceChangePercent,
    );

    return {
      ...position,
      market_val_usd: valueUsd,
      pl_val_usd: plUsd,
      price_change_24h_percent: priceChangePercent,
      price_change_24h_value: priceChangeValueUsd,
      source: 'futu', // will be overridden by caller
    };
  }

  async getSnapshot() {
    // 并行获取所有数据（IBKR 失败不阻塞）
    const [futuPositions, futuFunds, ibkrPositions, ibkrFunds] =
      await Promise.all([
        this.futuClient.getPositions(),
        this.futuClient.getFunds(),
        this.ibkrClient.getPositions(),
        this.ibkrClient.getFunds(),
      ]);

    const rates = await this.ratesService.getRates();
    const usdToCny = rates.usd_to_cny;
    const hkdToUsd = rates.hkd_to_usd;

    // 合并所有持仓代码，批量获取 24h 涨跌
    const allCodes = [
      ...futuPositions.map((p) => p.code),
      ...ibkrPositions.map((p) => p.code),
    ];
    const stock24hChangeMap =
      await this.marketService.getStocks24hChanges(allCodes);

    // Futu 持仓转 USD
    const futuPositionsUSD: PositionWithUSD[] = futuPositions.map((p) => ({
      ...this.convertToUsd(p, hkdToUsd, usdToCny, stock24hChangeMap),
      source: 'futu' as const,
    }));

    // IBKR 持仓转 USD
    const ibkrPositionsUSD: PositionWithUSD[] = ibkrPositions.map((p) => ({
      ...this.convertToUsd(p, hkdToUsd, usdToCny, stock24hChangeMap),
      source: 'ibkr' as const,
    }));

    const allPositions = [...futuPositionsUSD, ...ibkrPositionsUSD];

    // 计算总资产（统一 USD）
    const totalStockValue = allPositions.reduce(
      (sum, p) => sum + p.market_val_usd,
      0,
    );

    // Futu 现金
    const totalCashHkd = futuFunds.reduce((sum, f) => sum + f.hk_cash, 0);
    const totalCashUsdRaw = futuFunds.reduce((sum, f) => sum + f.us_cash, 0);
    const futuCashUsd = totalCashUsdRaw + totalCashHkd * hkdToUsd;
    const totalFundAssetsHkd = futuFunds.reduce(
      (sum, f) => sum + f.fund_assets,
      0,
    );
    const totalFundAssetsUsd = totalFundAssetsHkd * hkdToUsd;

    // IBKR 现金
    const ibkrCashUsd = ibkrFunds?.total_cash ?? 0;

    const totalCashUsd = futuCashUsd + ibkrCashUsd;

    return {
      timestamp: Date.now(),
      date: new Date().toISOString(),
      stocks: {
        positions: allPositions,
        totalValue: totalStockValue,
      },
      funds: {
        cash: totalCashUsd,
        fundAssets: totalFundAssetsUsd,
        cash_hkd: totalCashHkd,
        cash_usd_raw: totalCashUsdRaw,
        cash_usd: totalCashUsd,
        fund_assets_hkd: totalFundAssetsHkd,
        fund_assets_usd: totalFundAssetsUsd,
        ibkr_cash_usd: ibkrCashUsd,
        ibkr_net_liquidation: ibkrFunds?.net_liquidation ?? 0,
        details: futuFunds,
        ibkr_details: ibkrFunds,
      },
      rates: {
        usd_to_cny: usdToCny,
        hkd_to_usd: hkdToUsd,
      },
      total: totalStockValue + totalCashUsd + totalFundAssetsUsd,
    };
  }

  async checkHealth() {
    const [futuHealthy, ibkrHealthy] = await Promise.all([
      this.futuClient.healthCheck(),
      this.ibkrClient.healthCheck(),
    ]);

    const allHealthy = futuHealthy && ibkrHealthy;

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      services: {
        futu: futuHealthy ? 'ok' : 'down',
        ibkr: ibkrHealthy ? 'ok' : 'down',
      },
    };
  }
}
