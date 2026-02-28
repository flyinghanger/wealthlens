"""
Futu API Microservice
极简 Python 微服务，只负责富途 API 调用
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from futu import OpenSecTradeContext, OpenQuoteContext, TrdEnv, RET_OK, SecurityFirm
import os
from dotenv import load_dotenv
import logging

# 加载环境变量
load_dotenv()

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPI 应用
app = FastAPI(
    title="Futu Service",
    description="富途证券 API 微服务",
    version="1.0.0"
)

# CORS 配置（只允许本地 Node 后端访问）
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3001",
        "http://127.0.0.1:3001"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 富途配置
OPEND_HOST = os.getenv("FUTU_HOST", "127.0.0.1")
OPEND_PORT = int(os.getenv("FUTU_PORT", "11111"))
TRADE_PASSWORD = os.getenv("FUTU_TRADE_PASSWORD", "")

# 交易解锁状态
_trade_unlocked = False


def ensure_trade_unlocked():
    """确保交易已解锁（每次 OpenD 重启后需要重新解锁）"""
    global _trade_unlocked
    if _trade_unlocked or not TRADE_PASSWORD:
        return

    trd_ctx = None
    try:
        trd_ctx = OpenSecTradeContext(
            host=OPEND_HOST,
            port=OPEND_PORT,
            security_firm=SecurityFirm.FUTUSECURITIES
        )
        ret, data = trd_ctx.unlock_trade(password=TRADE_PASSWORD)
        if ret == RET_OK:
            _trade_unlocked = True
            logger.info("Trade unlocked successfully")
        else:
            logger.warning(f"Failed to unlock trade: {data}")
    except Exception as e:
        logger.warning(f"Error unlocking trade: {e}")
    finally:
        if trd_ctx:
            trd_ctx.close()


def to_number(value, default=0.0):
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def fetch_stock_24h_changes(codes):
    if not codes:
        return {}

    quote_ctx = OpenQuoteContext(host=OPEND_HOST, port=OPEND_PORT)
    try:
        unique_codes = list(dict.fromkeys(codes))
        ret, snapshot_df = quote_ctx.get_market_snapshot(unique_codes)
        if ret != RET_OK or snapshot_df is None or snapshot_df.empty:
            logger.warning("Failed to fetch stock market snapshot, 24h fields fallback to 0")
            return {}

        changes = {}
        for _, row in snapshot_df.iterrows():
            code = str(row.get('code', '')).strip()
            if not code:
                continue

            change_percent = to_number(row.get('change_rate'), 0.0)
            last_price = to_number(row.get('last_price'), 0.0)
            prev_close = to_number(row.get('prev_close_price'), 0.0)

            if prev_close <= 0 and last_price > 0 and change_percent != 0:
                prev_close = last_price / (1 + change_percent / 100)

            change_value = (last_price - prev_close) if last_price > 0 and prev_close > 0 else 0.0

            changes[code] = {
                'price_change_24h_percent': change_percent,
                'price_change_24h_value': change_value,
            }

        return changes
    except Exception as e:
        logger.warning(f"Error fetching stock 24h changes: {str(e)}")
        return {}
    finally:
        quote_ctx.close()


@app.get("/")
def health():
    """健康检查"""
    return {
        "status": "ok",
        "service": "futu-api",
        "version": "1.0.0"
    }


@app.get("/api/positions")
def get_positions():
    """
    获取股票持仓

    Returns:
        {
            "positions": [
                {
                    "code": "HK.00700",
                    "stock_name": "腾讯控股",
                    "qty": 100,
                    "cost_price": 350.5,
                    "nominal_price": 380.2,
                    "market_val": 38020,
                    "pl_val": 2970,
                    "pl_ratio": 8.47,
                    "price_change_24h_percent": 1.23,
                    "price_change_24h_value": 4.68,
                    "currency": "HKD"
                }
            ]
        }
    """
    ensure_trade_unlocked()
    trd_ctx = None
    try:
        logger.info("Fetching positions from Futu...")

        trd_ctx = OpenSecTradeContext(
            host=OPEND_HOST,
            port=OPEND_PORT,
            security_firm=SecurityFirm.FUTUSECURITIES
        )

        # 获取账户列表
        ret, acc_list = trd_ctx.get_acc_list()
        if ret != RET_OK:
            logger.error("Failed to get account list")
            raise HTTPException(500, "Failed to get account list")

        all_positions = []

        # 遍历所有账户获取持仓
        for _, row in acc_list.iterrows():
            acc_id = row['acc_id']

            ret_pos, pos_df = trd_ctx.position_list_query(
                acc_id=acc_id,
                trd_env=TrdEnv.REAL
            )

            if ret_pos == RET_OK and not pos_df.empty:
                # 过滤掉基金（如果需要）
                excluded_funds = {'HK.000355', 'HK.000205'}

                for _, p in pos_df.iterrows():
                    code = str(p.get('code', '')).strip()

                    # 跳过基金
                    if code in excluded_funds:
                        continue

                    # 判断货币
                    if code.startswith("HK."):
                        currency = "HKD"
                    elif code.startswith("US."):
                        currency = "USD"
                    elif code.startswith(("SH.", "SZ.")):
                        currency = "CNY"
                    else:
                        currency = "USD"

                    position = {
                        'code': code,
                        'stock_name': str(p.get('stock_name', '')).strip(),
                        'qty': to_number(p.get('qty'), 0),
                        'cost_price': to_number(p.get('cost_price'), 0),
                        'nominal_price': to_number(p.get('nominal_price'), 0),
                        'market_val': to_number(p.get('market_val'), 0),
                        'pl_val': to_number(p.get('pl_val'), 0),
                        'pl_ratio': to_number(p.get('pl_ratio'), 0),
                        'price_change_24h_percent': 0.0,
                        'price_change_24h_value': 0.0,
                        'currency': currency
                    }

                    all_positions.append(position)

        # 批量补齐 24h 涨跌（使用 Futu quote snapshot）
        change_map = fetch_stock_24h_changes([p['code'] for p in all_positions])
        for position in all_positions:
            change = change_map.get(position['code'])
            if not change:
                continue

            position['price_change_24h_percent'] = to_number(
                change.get('price_change_24h_percent'),
                0,
            )
            position['price_change_24h_value'] = to_number(
                change.get('price_change_24h_value'),
                0,
            )

        logger.info(f"Successfully fetched {len(all_positions)} positions")
        return {"positions": all_positions}

    except Exception as e:
        logger.error(f"Error fetching positions: {str(e)}")
        raise HTTPException(500, f"Failed to fetch positions: {str(e)}")
    finally:
        if trd_ctx:
            trd_ctx.close()


@app.get("/api/funds")
def get_funds():
    """
    获取账户资金信息

    Returns:
        {
            "funds": [
                {
                    "acc_id": "xxx",
                    "hk_cash": 50000,
                    "us_cash": 10000,
                    "fund_assets": 80000
                }
            ]
        }
    """
    ensure_trade_unlocked()
    trd_ctx = None
    try:
        logger.info("Fetching funds from Futu...")

        trd_ctx = OpenSecTradeContext(
            host=OPEND_HOST,
            port=OPEND_PORT,
            security_firm=SecurityFirm.FUTUSECURITIES
        )

        ret, acc_list = trd_ctx.get_acc_list()
        if ret != RET_OK:
            raise HTTPException(500, "Failed to get account list")

        funds_data = []

        for _, row in acc_list.iterrows():
            acc_id = row['acc_id']

            ret_fund, fund_df = trd_ctx.accinfo_query(
                acc_id=acc_id,
                trd_env=TrdEnv.REAL
            )

            if ret_fund == RET_OK and not fund_df.empty:
                # 转换为数值类型，处理 'N/A' 等非数值
                import pandas as pd
                fund_df['hk_cash'] = pd.to_numeric(fund_df['hk_cash'], errors='coerce').fillna(0)
                fund_df['us_cash'] = pd.to_numeric(fund_df['us_cash'], errors='coerce').fillna(0)
                fund_df['fund_assets'] = pd.to_numeric(fund_df['fund_assets'], errors='coerce').fillna(0)

                fund_info = {
                    'acc_id': acc_id,
                    'hk_cash': float(fund_df['hk_cash'].sum()),
                    'us_cash': float(fund_df['us_cash'].sum()),
                    'fund_assets': float(fund_df['fund_assets'].sum()),
                }

                funds_data.append(fund_info)

        logger.info(f"Successfully fetched funds for {len(funds_data)} accounts")
        return {"funds": funds_data}

    except Exception as e:
        logger.error(f"Error fetching funds: {str(e)}")
        raise HTTPException(500, f"Failed to fetch funds: {str(e)}")
    finally:
        if trd_ctx:
            trd_ctx.close()


if __name__ == "__main__":
    import uvicorn

    logger.info("Starting Futu API Service...")
    logger.info(f"Futu OpenD: {OPEND_HOST}:{OPEND_PORT}")

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="info"
    )
