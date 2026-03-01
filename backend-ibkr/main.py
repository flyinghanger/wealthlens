"""
IBKR 微服务 — 持久连接 IB Gateway
端口: 8001
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import os
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

IB_HOST = os.getenv("IB_HOST", "127.0.0.1")
IB_PORT = int(os.getenv("IB_PORT", "4001"))
IB_CLIENT_ID = int(os.getenv("IB_CLIENT_ID", "10"))

ib = None  # 全局持久连接

def to_number(value, default=0.0):
    try:
        return float(value) if value is not None else default
    except (TypeError, ValueError):
        return default

async def ensure_connected():
    global ib
    from ib_async import IB
    if ib and ib.isConnected():
        return ib
    ib = IB()
    await ib.connectAsync(IB_HOST, IB_PORT, clientId=IB_CLIENT_ID, timeout=15)
    logger.info(f"Connected to IB Gateway, accounts: {ib.managedAccounts()}")
    return ib

@asynccontextmanager
async def lifespan(app):
    # 启动时连接
    try:
        await ensure_connected()
    except Exception as e:
        logger.warning(f"Initial IB connection failed: {e}")
    yield
    # 关闭时断开
    global ib
    if ib and ib.isConnected():
        ib.disconnect()

app = FastAPI(title="IBKR Gateway Service", version="3.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def health():
    try:
        conn = await ensure_connected()
        return {"status": "connected", "accounts": conn.managedAccounts()}
    except Exception as e:
        return {"status": "disconnected", "error": str(e)}

@app.get("/api/funds")
async def get_funds():
    try:
        conn = await ensure_connected()
        summary = await asyncio.wait_for(conn.accountSummaryAsync(), timeout=30)

        result = {}
        for s in summary:
            if s.tag == "NetLiquidation" and s.currency == "USD":
                result["net_liquidation"] = to_number(s.value)
                result["currency"] = "USD"
            elif s.tag == "TotalCashValue" and s.currency == "USD":
                result["cash"] = to_number(s.value)
            elif s.tag == "GrossPositionValue" and s.currency == "USD":
                result["gross_position"] = to_number(s.value)
            elif s.tag == "UnrealizedPnL" and s.currency == "BASE":
                result["unrealized_pnl"] = to_number(s.value)

        logger.info(f"Funds: net={result.get('net_liquidation')} cash={result.get('cash')}")
        return result
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Timeout")
    except Exception as e:
        logger.error(f"funds error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/positions")
async def get_positions():
    try:
        conn = await ensure_connected()
        positions = await asyncio.wait_for(conn.reqPositionsAsync(), timeout=60)

        result = []
        for pos in positions:
            contract = pos.contract
            qty = to_number(pos.position)
            avg_cost = to_number(pos.avgCost)
            if qty == 0:
                continue

            market_val = abs(qty * avg_cost)
            result.append({
                "code": contract.symbol,
                "stock_name": contract.localSymbol or contract.symbol,
                "qty": qty,
                "cost_price": avg_cost,
                "nominal_price": avg_cost,
                "market_val": market_val,
                "market_val_usd": market_val,
                "pl_val": 0,
                "pl_val_usd": 0,
                "currency": contract.currency or "USD",
                "source": "ibkr",
            })

        logger.info(f"Positions: {len(result)} holdings")
        return {"positions": result, "count": len(result)}
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Timeout")
    except Exception as e:
        logger.error(f"positions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
