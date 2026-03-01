import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

const IBKR_SERVICE_URL = 'http://127.0.0.1:8001';

export interface IbkrPosition {
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
  exchange?: string;
  sec_type?: string;
}

export interface IbkrFunds {
  net_liquidation: number;
  total_cash: number;
  buying_power: number;
  unrealized_pnl: number;
  realized_pnl: number;
  currency: string;
  details: Record<string, number>;
}

@Injectable()
export class IbkrClient {
  constructor(private readonly httpService: HttpService) {}

  /**
   * 获取 IBKR 持仓
   */
  async getPositions(): Promise<IbkrPosition[]> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<{ positions: IbkrPosition[] }>(
          `${IBKR_SERVICE_URL}/api/positions`,
          { timeout: 60000 },
        ),
      );
      return data.positions;
    } catch (error) {
      console.error('Failed to fetch IBKR positions:', error.message);
      // IBKR 不可用时不阻塞整体，返回空数组
      return [];
    }
  }

  /**
   * 获取 IBKR 账户资金
   */
  async getFunds(): Promise<IbkrFunds | null> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<any>(
          `${IBKR_SERVICE_URL}/api/funds`,
          { timeout: 45000 },
        ),
      );
      const funds = data.funds || data; return funds.net_liquidation ? funds : null;
    } catch (error) {
      console.error('Failed to fetch IBKR funds:', error.message);
      return null;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<{ status: string; ib_connected: boolean }>(
          `${IBKR_SERVICE_URL}/`,
          { timeout: 2000 },
        ),
      );
      return data.status === 'connected' || (data.status === 'ok' && data.ib_connected);
    } catch {
      return false;
    }
  }
}
