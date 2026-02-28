"""
IBKR Client Portal API 微服务
通过本地 Client Portal Gateway 获取持仓和账户信息
不需要 IB Gateway / TWS，不占用手机 session

前置：
1. 下载 Client Portal Gateway: https://www.interactivebrokers.com/en/trading/ib-api.php
2. 启动: cd clientportal.gw && sh bin/run.sh root/conf.yaml
3. 浏览器打开 https://localhost:5000，登录一次
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import logging
import httpx

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

CP_HOST = os.getenv("CP_HOST", "https://localhost:5000")
CP_VERIFY_SSL = os.getenv("CP_VERIFY_SSL", "false").lower() != "true"  # 本地自签名证书，默认跳过验证

app = FastAPI(title="IBKR Client Portal Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://127.0.0.1:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_client():
    return httpx.Client(base_url=CP_HOST, verify=False, timeout=15.0)


def to_number(value, default=0.0):
    try:
        return float(value) if value is not None else default
    except (TypeError, ValueError):
        return default


@app.get("/")
def health():
    """健康检查 + 验证 Client Portal 是否登录"""
    try:
        with get_client() as client:
            r = client.get("/v1/api/iserver/auth/status")
            data = r.json()
            authenticated = data.get("authenticated", False)
            connected = data.get("connected", False)
            return {
                "status": "ok" if authenticated else "disconnected",
                "service": "ibkr-clientportal",
                "version": "2.0.0",
                "ib_connected": authenticated and connected,
                "authenticated": authenticated,
                "connected": connected,
            }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "disconnected",
            "service": "ibkr-clientportal",
            "version": "2.0.0",
            "ib_connected": False,
            "error": str(e),
        }


def get_accounts(client):
    """获取账户列表"""
    r = client.get("/v1/api/iserver/accounts")
    r.raise_for_status()
    data = r.json()
    accounts = data.get("accounts", [])
    if not accounts:
        raise HTTPException(503, "No IBKR accounts found")
    return accounts


@app.get("/api/positions")
def get_positions():
    """获取 IBKR 持仓"""
    try:
        with get_client() as client:
            # 先获取账户
            accounts = get_accounts(client)
            account_id = accounts[0]
            logger.info(f"Fetching positions for account: {account_id}")

            # 获取持仓
            r = client.get(f"/v1/api/portfolio/{account_id}/positions/0")
            r.raise_for_status()
            raw_positions = r.json()

            if not raw_positions:
                return {"positions": []}

            result = []
            for pos in raw_positions:
                qty = to_number(pos.get("position", 0))
                if qty == 0:
                    continue

                currency = pos.get("currency", "USD")
                symbol = pos.get("ticker", pos.get("contractDesc", ""))
                sec_type = pos.get("assetClass", "STK")
                exchange = pos.get("listingExchange", "")
                avg_cost = to_number(pos.get("avgCost", 0))
                mkt_price = to_number(pos.get("mktPrice", 0))
                mkt_value = to_number(pos.get("mktValue", 0))
                unrealized_pnl = to_number(pos.get("unrealizedPnl", 0))

                # 构造 code（与 futu 格式对齐）
                if currency == "USD":
                    code = f"US.{symbol}"
                elif currency == "HKD":
                    code = f"HK.{symbol}"
                elif currency == "EUR":
                    code = f"EUR.{symbol}"
                else:
                    code = f"{currency}.{symbol}"

                pl_ratio = (unrealized_pnl / (avg_cost * qty) * 100) if avg_cost and qty else 0

                result.append({
                    "code": code,
                    "stock_name": symbol,
                    "qty": qty,
                    "cost_price": avg_cost,
                    "nominal_price": mkt_price,
                    "market_val": mkt_value,
                    "pl_val": unrealized_pnl,
                    "pl_ratio": pl_ratio,
                    "price_change_24h_percent": 0.0,
                    "price_change_24h_value": 0.0,
                    "currency": currency,
                    "exchange": exchange,
                    "sec_type": sec_type,
                })

            logger.info(f"Fetched {len(result)} positions")
            return {"positions": result}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching positions: {e}")
        raise HTTPException(500, f"Failed to fetch positions: {str(e)}")


@app.get("/api/funds")
def get_funds():
    """获取 IBKR 账户资金"""
    try:
        with get_client() as client:
            accounts = get_accounts(client)
            account_id = accounts[0]
            logger.info(f"Fetching funds for account: {account_id}")

            # 获取账户摘要
            r = client.get(f"/v1/api/portfolio/{account_id}/summary")
            r.raise_for_status()
            summary = r.json()

            def get_val(key):
                item = summary.get(key, {})
                return to_number(item.get("amount", 0))

            net_liquidation = get_val("netliquidation")
            total_cash = get_val("totalcashvalue")
            buying_power = get_val("buyingpower")
            unrealized_pnl = get_val("unrealizedpnl")
            realized_pnl = get_val("realizedpnl")

            logger.info(f"Account {account_id}: NetLiq={net_liquidation:.2f}, Cash={total_cash:.2f}")
            return {
                "funds": {
                    "net_liquidation": net_liquidation,
                    "total_cash": total_cash,
                    "buying_power": buying_power,
                    "unrealized_pnl": unrealized_pnl,
                    "realized_pnl": realized_pnl,
                    "currency": "USD",
                    "details": summary,
                }
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching funds: {e}")
        raise HTTPException(500, f"Failed to fetch funds: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting IBKR Client Portal Service, connecting to {CP_HOST}")
    uvicorn.run(app, host="127.0.0.1", port=8001, log_level="info")
