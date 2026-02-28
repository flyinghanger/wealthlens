import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

const FUTU_SERVICE_URL = 'http://127.0.0.1:8000';

export interface FutuPosition {
  code: string;
  stock_name: string;
  qty: number;
  cost_price: number;
  nominal_price: number;
  market_val: number;
  pl_val: number;
  pl_ratio: number;
  price_change_24h_percent?: number;
  price_change_24h_value?: number;
  currency: string;
}

export interface FutuFund {
  acc_id: string;
  hk_cash: number;
  us_cash: number;
  fund_assets: number;
}

@Injectable()
export class FutuClient {
  constructor(private readonly httpService: HttpService) {}

  /**
   * 获取股票持仓
   */
  async getPositions(): Promise<FutuPosition[]> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<{ positions: FutuPosition[] }>(
          `${FUTU_SERVICE_URL}/api/positions`,
          { timeout: 10000 },
        ),
      );
      return data.positions;
    } catch (error) {
      console.error('Failed to fetch Futu positions:', error.message);
      throw new HttpException(
        'Futu service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * 获取账户资金
   */
  async getFunds(): Promise<FutuFund[]> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<{ funds: FutuFund[] }>(
          `${FUTU_SERVICE_URL}/api/funds`,
          { timeout: 10000 },
        ),
      );
      return data.funds;
    } catch (error) {
      console.error('Failed to fetch Futu funds:', error.message);
      throw new HttpException(
        'Futu service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<{ status: string }>(
          `${FUTU_SERVICE_URL}/`,
          { timeout: 2000 },
        ),
      );
      return data.status === 'ok';
    } catch {
      return false;
    }
  }
}
