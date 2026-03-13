# WealthLens CLI Skill

> 多券商资产看板 CLI 工具

## 触发词

用户说以下任一关键词时触发看板：
- `wl` / `看板` / `dashboard` / `wealthlens`

## 用法

```bash
# 一次性查看（优先走 backend API，失败自动降级为直连）
wl

# 强制直连交易所（不依赖 backend）
wl --direct

# 持续刷新
wl --watch
wl --watch --interval 30
```

## 数据源

| 来源 | 端口 | 说明 |
|------|------|------|
| Futu | 8000 | 港股/美股（需 Futu OpenD） |
| IBKR | 8001 | 美股（需 IB Gateway + IBC） |
| OKX | - | 加密货币（直连 API） |
| Binance | - | 加密货币（直连 API） |
| Bitget | - | 加密货币（直连 API） |

## 依赖

- Python 3.9+（无第三方依赖）
- `config/secrets.json` — 交易所 API 密钥
- Futu 微服务（端口 8000）— 可选
- IBKR 微服务（端口 8001）— 可选

## 降级策略

1. 优先走 NestJS backend API（端口 3001）
2. Backend 不可用 → 直连各交易所微服务 + API
3. 某交易所连接失败 → 静默跳过，显示可用数据
4. 汇率获取失败 → 使用磁盘缓存 → 硬编码兜底

## 缓存

- 快照缓存：10 分钟 TTL（`data/snapshot-cache.json`）
- 汇率缓存：8 小时 TTL（`data/rates-cache.json`），磁盘持久化

## IB Gateway 启动

```bash
cd ~/ibc && bash gatewaystartmacos.sh -inline &
# 等待端口 4001 就绪后启动 backend-ibkr
cd /path/to/wealth-dashboard-v2/backend-ibkr
source venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8001
```

## 输出格式

终端彩色表格，按市值降序排列：
- 股票持仓（Futu / IBKR）含盈亏
- 加密货币（按交易所分组）
- 总盈亏汇总
- USD/CNY 汇率

## 安装

```bash
# 从项目根目录创建符号链接
ln -sf $(pwd)/wealthlens /usr/local/bin/wl
ln -sf $(pwd)/wealthlens /usr/local/bin/wealthlens
```
