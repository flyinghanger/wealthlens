# IBKR Client Portal API 微服务

通过 IBKR Client Portal Gateway 获取持仓和账户信息。
**不需要 IB Gateway / TWS，不踢手机 session。**

## 前置步骤

### 1. 下载 Client Portal Gateway
https://www.interactivebrokers.com/en/trading/ib-api.php
→ 找 "Client Portal API" → 下载 `clientportal.gw.zip`

### 2. 启动 Gateway
```bash
unzip clientportal.gw.zip
cd clientportal.gw
sh bin/run.sh root/conf.yaml
```

### 3. 浏览器登录
打开 https://localhost:5000 → 用 IBKR 账号登录（只需一次）

### 4. 启动本服务
```bash
source venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8001
```

## API

- `GET /` - 健康检查（含登录状态）
- `GET /api/positions` - 获取持仓
- `GET /api/funds` - 获取账户资金

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| CP_HOST | https://localhost:5000 | Client Portal Gateway 地址 |
