# Wealth Dashboard V2 - Agent Handoff

更新时间：2026-02-10
项目路径：`/Users/clawdbot/Documents/wealth-dashboard-v2`

---

## 1) 当前完成进度（已落地）

### Crypto 数据链路
- 已补齐聚合来源：
  - OKX Web（有 token 时）
  - OKX V5（Web 失败时自动回退）
  - Binance Spot / Funding / Simple Earn / Futures
  - Hyperliquid
- 聚合输出：`GET /api/crypto`
- 关键代码：`backend/src/crypto/crypto.service.ts`

### OKX / Binance 状态可观测
- 新增 `GET /api/crypto/health`
- 返回 OKX/Binance 当前 ingest 来源与凭证状态：
  - `okx.source`: `web | v5 | none`
  - `okx.tokenSource`: `config | legacy | none`
  - `binance.source`: `api-key | none`
- 关键代码：`backend/src/crypto/crypto.controller.ts`、`backend/src/crypto/crypto.service.ts`

### OKX token 双来源策略
- 优先读取 `config/secrets.json` 的 `okx.webToken`
- 若无，则读取 v1 里的 legacy token：`../wealth-dashboard/scripts/crypto_fetcher.py`
- 关键代码：`backend/src/crypto/crypto.service.ts`

### 汇率与币种统一
- 新增实时汇率服务 `GET /api/rates`（5 分钟缓存，来源 open.er-api）
- Futu 持仓统一换算 USD（HKD/CNY -> USD）
- 输出增强字段：`market_val_usd`、`pl_val_usd`、`cash_usd`、`fund_assets_usd`
- 关键代码：
  - `backend/src/rates/rates.service.ts`
  - `backend/src/rates/rates.controller.ts`
  - `backend/src/assets/assets.service.ts`

### Chain 侧修复
- HyperEVM 改主网 RPC：`https://rpc.hyperliquid.xyz/evm`
- 链上价格 Coingecko + fallback，provider 与价格都有缓存
- 支持扫描稳定币 ERC20（USDT/USDC）
- 关键代码：`backend/src/chain/chain.service.ts`

### 前端展示与交互
- 四大卡片口径统一：
  - Stocks
  - Crypto (Risk)
  - USD Savings
  - CNY Assets
- 已增加 USD vs CNY 饼图
- 已增加数据来源状态 badge（OKX/Binance）
- `Stock Positions` + `Crypto Assets (Risk)` 表头排序（升/降序）
- 关键代码：`frontend/app/dashboard/page.tsx`

### 汇率快照（新增）
- 快照已新增 `ratesSnapshot`（`usd_to_cny` / `hkd_to_usd` / `source` / `rates_updated_at` / `captured_at`）
- 手动快照与内置 CRON 快照都会写入当时汇率，便于后续做汇率影响归因分析
- 关键代码：`backend/src/snapshot/snapshot.entity.ts`、`backend/src/snapshot/history.controller.ts`、`backend/src/scheduler/snapshot.scheduler.ts`

### Trend / Snapshot 口径统一（核心改造）
- 快照 schema 升级：新增
  - `formulaVersion`
  - `stocksBucketUsd`
  - `cryptoRiskBucketUsd`
  - `usdSavingsBucketUsd`
  - `cnyAssetsBucketUsd`
- 新公式版本：`formulaVersion = 2`
- 手动快照与定时快照统一使用同一套 bucket 公式
- 趋势接口改为返回四条线 + total：
  - `stocks`
  - `cryptoRisk`
  - `usdSavings`
  - `cnyAssets`
  - `total`
- 前端 `Portfolio Trend` 已改为四条分类线 + `Total` 虚线
- 关键代码：
  - `backend/src/snapshot/snapshot.entity.ts`
  - `backend/src/snapshot/snapshot-buckets.ts`
  - `backend/src/snapshot/history.controller.ts`
  - `backend/src/scheduler/snapshot.scheduler.ts`
  - `frontend/app/components/TrendChart.tsx`

---

## 2) 现状数据来源（实时 / 本地）

### 实时拉取
- `/api/assets/snapshot`：通过 Futu Python 服务聚合（股票/基金/现金）
- `/api/crypto`：实时拉 OKX/Binance/Hyperliquid（带价格缓存）
- `/api/chain`：实时 RPC 查链上余额（带 provider/price 缓存）
- `/api/rates`：实时汇率（5 分钟缓存）

### 本地文件
- `/api/feishu/latest`：读取本地 CSV：
  - `~/Documents/futu-history/feishu-asset-cleaned.csv`
  - 服务内缓存 5 分钟

---

## 3) “实时”机制说明（用户刷新时发生什么）

前端 `dashboard` 行为：
- 页面加载后立即请求一次所有接口
- 每 30 秒自动轮询一次
- 所以用户刷新页面会触发一轮最新拉取
- 关键代码：`frontend/app/dashboard/page.tsx`

---

## 4) 快照与趋势接口（给定时任务 agent）

### 手动打快照
- `POST /api/history/snapshot`
- 返回：`id/timestamp/total/realtime_total/buckets/formula_version`

### 查看趋势
- `GET /api/history/trend?days=7`
- 返回四条分类线 + total（USD 口径）

### 最新快照
- `GET /api/history/latest`
- 返回 buckets + positions 明细

### 说明
- 已清理旧口径（`formulaVersion < 2`）快照，避免趋势混口径
- 当前仅保留 v2 口径快照（可直接用于同比/环比）

---

## 5) 当前快照基线（已确认）

数据库：`data/wealth.db` 表：`snapshots`

当前保留：
- `id=8`（formulaVersion=2）
- `id=9`（formulaVersion=2）

可用于明天继续对比。

---

## 6) 启动与运行方法（改造后）

### 重要
必须先进入项目根目录再启动，否则 `start-dev.sh` 内部相对路径会失败。

```bash
cd /Users/clawdbot/Documents/wealth-dashboard-v2
bash start-dev.sh
```

启动后：
- Frontend: `http://localhost:3000`
- API: `http://localhost:3001`
- Futu docs: `http://localhost:8000/docs`

---

## 7) 建议给下一个 agent 的定时任务策略

### 方案建议（避免重复写）
当前 backend 已改为内置 CRON（每日两次）：
- `SNAPSHOT_CRON_1`（默认 `0 6 * * *`）
- `SNAPSHOT_CRON_2`（默认 `0 20 * * *`）
- cleanup 在 cron-1 执行后触发

若另一个 agent 还要做外部 cron，请二选一：
1. **保留内置 CRON**（推荐，最简单）
2. **禁用内置 CRON，改外部触发**（避免双写）

### 外部触发最小实现
- 定时调用：`POST /api/history/snapshot`
- 记录响应中的 `id/formula_version/total`
- 失败重试并告警

---

## 8) 单位策略（已定）

- 展示层（用户视角）：大字 CNY + 小字 USD
- 存储层（分析视角）：统一 USD
- 快照同时保留当时汇率（用于历史回放与 AI 复盘）

这套策略可确保：
- 用户看起来直观
- 趋势与回测口径稳定
- AI 归因分析不受汇率展示波动干扰

