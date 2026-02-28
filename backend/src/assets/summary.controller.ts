import { Controller, Get } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RatesService } from '../rates/rates.service';
import { AssetsService } from './assets.service';

@Controller('api/summary')
export class SummaryController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly httpService: HttpService,
    private readonly ratesService: RatesService,
  ) {}

  /**
   * 获取完整资产总览
   * 整合 Futu + Crypto + Chain + Feishu
   */
  @Get()
  async getSummary() {
    try {
      // 并行获取所有数据
      const [futuSnapshot, cryptoRes, chainRes, feishuRes] = await Promise.all([
        this.assetsService.getSnapshot(),
        firstValueFrom(
          this.httpService.get('http://127.0.0.1:3001/api/crypto', {
            timeout: 5000,
          }),
        ).catch(() => ({ data: [] })),
        firstValueFrom(
          this.httpService.get('http://127.0.0.1:3001/api/chain', {
            timeout: 5000,
          }),
        ).catch(() => ({ data: [] })),
        firstValueFrom(
          this.httpService.get('http://127.0.0.1:3001/api/feishu/latest', {
            timeout: 5000,
          }),
        ).catch(() => ({ data: null })),
      ]);

      const stockPositions = futuSnapshot.stocks?.positions || [];
      const cryptoPositions = cryptoRes.data || [];
      const chainAssets = chainRes.data || [];
      const feishuData = feishuRes.data;

      // 计算总值
      const cryptoTotal = cryptoPositions.reduce(
        (sum: number, p: any) => sum + Number(p.value_usd || 0),
        0,
      );
      const chainTotal = chainAssets.reduce(
        (sum: number, a: any) => sum + Number(a.value_usd || 0),
        0,
      );

      // Futu 数据
      const stocksValue = futuSnapshot.stocks?.totalValue || 0;
      // `funds.cash_usd` / `funds.cash` 仅来自 Futu 证券账户资金（us_cash + hk_cash 折算 USD）。
      // 不包含银行卡活期余额；银行卡余额来自飞书字段 `balance_cny`。
      const cashValue = Number(
        futuSnapshot.funds?.cash_usd ?? futuSnapshot.funds?.cash ?? 0,
      );
      const fundAssetsValue = futuSnapshot.funds?.fundAssets || 0;

      // 24h 涨跌（USD 口径）
      const stocks24hChangeUsd = stockPositions.reduce(
        (sum: number, p: any) => sum + Number(p.price_change_24h_value || 0),
        0,
      );
      const crypto24hChangeUsd = cryptoPositions.reduce(
        (sum: number, p: any) => sum + Number(p.price_change_24h_value || 0),
        0,
      );
      const market24hChangeUsd = stocks24hChangeUsd + crypto24hChangeUsd;

      // 汇率（实时，含缓存）
      const rates = await this.ratesService.getRates();
      const USD_TO_CNY = rates.usd_to_cny;
      const HKD_TO_USD = rates.hkd_to_usd;
      const bankCashUsd =
        feishuData && !feishuData.error
          ? Number(feishuData.balance_cny || 0) / USD_TO_CNY
          : 0;
      const totalCashUsd = cashValue + bankCashUsd;

      // 飞书数据转换为 USD
      let feishuUSD = 0;
      if (feishuData && !feishuData.error) {
        const stocksFeishu = (feishuData.stocks_hk_us_cny || 0) / USD_TO_CNY;
        const usdSavings = feishuData.usd_savings || 0;
        const fundsCNY = (feishuData.funds_cny || 0) / USD_TO_CNY;
        const balanceCNY = (feishuData.balance_cny || 0) / USD_TO_CNY;
        const providentFund = (feishuData.provident_fund_cny || 0) / USD_TO_CNY;
        const debt = (feishuData.debt_cny || 0) / USD_TO_CNY;
        const token = feishuData.token_usd || 0;
        const defiUSD = feishuData.defi_usd || 0;

        feishuUSD =
          stocksFeishu +
          usdSavings +
          fundsCNY +
          balanceCNY +
          providentFund -
          debt +
          token +
          defiUSD;
      }

      // 总计（实时 + 飞书）
      const realTimeTotal = stocksValue + cashValue + fundAssetsValue + cryptoTotal + chainTotal;
      const grandTotal = realTimeTotal; // 如果要包含飞书：+ feishuUSD

      return {
        timestamp: Date.now(),
        summary: {
          // 实时数据（USD）
          realtime: {
            stocks: stocksValue,
            cash: cashValue,
            cash_brokerage_usd: cashValue,
            cash_bank_usd: bankCashUsd,
            cash_total_usd: totalCashUsd,
            funds: fundAssetsValue,
            crypto: cryptoTotal,
            chain: chainTotal,
            subtotal: realTimeTotal,
            stocks_24h_change_usd: stocks24hChangeUsd,
            crypto_24h_change_usd: crypto24hChangeUsd,
            market_24h_change_usd: market24hChangeUsd,
          },
          // 飞书数据（USD 转换后）
          feishu: feishuData
            ? {
                date: feishuData.date,
                stocks_hk_us_usd: (feishuData.stocks_hk_us_cny || 0) / USD_TO_CNY,
                usd_savings: feishuData.usd_savings || 0,
                funds_cny_usd: (feishuData.funds_cny || 0) / USD_TO_CNY,
                balance_cny_usd: (feishuData.balance_cny || 0) / USD_TO_CNY,
                provident_fund_usd: (feishuData.provident_fund_cny || 0) / USD_TO_CNY,
                debt_usd: (feishuData.debt_cny || 0) / USD_TO_CNY,
                token: feishuData.token_usd || 0,
                defi_usd: feishuData.defi_usd || 0,
                subtotal: feishuUSD,
              }
            : null,
          // 总计
          total: grandTotal,
        },
        details: {
          stocks: {
            count: stockPositions.length,
            positions: stockPositions,
          },
          crypto: {
            count: cryptoPositions.length,
            positions: cryptoPositions,
          },
          chain: {
            count: chainAssets.length,
            assets: chainAssets,
          },
        },
        rates: {
          usd_to_cny: USD_TO_CNY,
          hkd_to_usd: HKD_TO_USD,
        },
      };
    } catch (error) {
      return {
        error: 'Failed to fetch summary',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
