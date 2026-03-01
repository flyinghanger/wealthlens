# 💰 WealthLens

A multi-broker **wealth aggregation tool** with three interfaces:

🖥️ **GUI** — Next.js dashboard for visual overview
⌨️ **CLI/TUI** — Terminal dashboard for quick checks
💬 **Chat** — AI-powered queries via Telegram/OpenClaw

### Supported Data Sources
- 📈 **Stocks**: Futu (HK/US) + Interactive Brokers (US)
- 💎 **Crypto**: OKX, Binance, Bitget + on-chain wallets
- 💱 **FX Rates**: Multi-source with smart caching (currencyapi → exchangerate-api → open.er-api)
- 📊 **Historical**: SQLite snapshots with data integrity checks

---

## 🎯 Key Features

### Multi-Source Integration
- **CEX**: OKX, Binance, Bitget spot/futures
- **DEX**: Multi-chain wallet tracking (ETH, BSC, Arbitrum, Base, etc.)
- **Stocks**: Futu Securities API (US/HK) + IBKR (US markets)
- **Manual**: Custom entries for cash, funds, etc.

### Smart Data Collection
- Automatic balance fetching
- Market price caching
- Snapshot system with data integrity checks
- Fallback mechanisms for API failures

### Analytics & Visualization
- Total net worth tracking
- Asset distribution charts
- Top holdings ranking
- Historical trend analysis
- 24h/7d/30d change comparison

### Tech Stack
- **Backend**: NestJS + TypeScript + TypeORM + SQLite
- **Frontend**: Next.js 15 + React 19 + TailwindCSS + Recharts
- **TUI**: Python (zero dependencies)
- **Futu Service**: Python + Futu OpenD
- **IBKR Service**: Python + IB Gateway
- **Process Manager**: PM2 for zero-downtime

---

## 📸 Screenshots

*(Add your screenshots here after setup)*

---

## 🚀 Quick Start

### 1. Setup API Keys

```bash
cp config/secrets.example.json config/secrets.json
# Edit secrets.json with your real API keys
```

### 2. Install Dependencies

```bash
# Backend
cd backend && npm install && npm run build

# Frontend
cd frontend && npm install

# Futu Service
cd backend-futu && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt
```

### 3. Start Services

```bash
# Development mode (3 terminals)
cd backend-futu && python main.py
cd backend && npm run start:dev
cd frontend && npm run dev

# OR Production mode (PM2)
npm install -g pm2
pm2 start ecosystem.config.js
```

### 4. Use It

**GUI** — Open in browser:
```bash
open http://localhost:3000/dashboard
```

**CLI/TUI** — Quick terminal check:
```bash
# One-shot view
python3 tui.py

# Auto-refresh every 60s
python3 tui.py --watch

# Custom interval
python3 tui.py --watch --interval 30
```

**Chat via OpenClaw** — Talk to your portfolio:

WealthLens works as an [OpenClaw](https://github.com/openclaw/openclaw) agent backend.
Once the API server is running, your AI assistant can query portfolio data conversationally:

```
You:  看板
Bot:  💰 WealthLens Dashboard
      总资产 $335,893 (¥2,305,283)
      ── 股票 ──────────────
        NVIDIA       $ 37,074  +$42,326
        ...

You:  我的加密资产有多少？
Bot:  OKX $36,122 | Binance $7,498 | Bitget $872
      加密总资产: $44,492

You:  汇率多少？
Bot:  USD/CNY 6.8582 (来源: currencyapi.com)
```

No special integration needed — any AI agent that can call HTTP APIs can use WealthLens as a data backend.

---

## 📖 Full Documentation

- **[SETUP.md](./SETUP.md)** - Complete setup guide with troubleshooting
- **[QUICKSTART.md](./QUICKSTART.md)** - Quick reference for common tasks
- **[AGENT_HANDOFF.md](./AGENT_HANDOFF.md)** - For AI agents to understand the system

---

## 🏗️ Architecture

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Browser  │  │ CLI/TUI  │  │ OpenClaw │
│ :3000    │  │ tui.py   │  │ Telegram │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │              │
     └─────────────┼──────────────┘
                   │ HTTP
                   ▼
            ┌──────────────┐
            │   NestJS     │
            │   Backend    │
            │   :3001      │
            └──────┬───────┘
                   │
     ┌─────────┬───┴───┬──────────┐
     │         │       │          │
     ▼         ▼       ▼          ▼
┌─────────┐ ┌──────┐ ┌────────┐ ┌───────┐
│  Futu   │ │ IBKR │ │ Crypto │ │  FX   │
│ :8000   │ │ :8001│ │ (ccxt) │ │ Rates │
└─────────┘ └──────┘ └────────┘ └───────┘
     │         │         │
     ▼         ▼         ▼
  Futu OpenD  IB GW   OKX/BN/BG
```

---

## 📊 Data Flow

1. **Scheduled Collection** (every 6h)
   - Fetch balances from exchanges
   - Query on-chain wallet data
   - Get latest market prices
   - Calculate total net worth

2. **Snapshot Creation**
   - Store timestamped snapshot in SQLite
   - Run data integrity checks
   - Fallback to cached data if APIs fail

3. **Frontend Display**
   - Fetch latest snapshot via API
   - Render charts & tables
   - Show historical comparisons

---

## 🔐 Security & Privacy

⚠️ **This template has all sensitive data removed:**
- ✅ No API keys
- ✅ No wallet addresses
- ✅ No database with real balances
- ✅ Git history cleaned

**Before deploying:**
1. Keep `config/secrets.json` out of Git (already in `.gitignore`)
2. Use read-only API keys
3. Run on localhost or secure VPN
4. Regular database backups

---

## 🛠️ Customization

### Add New Exchange

Edit `backend/src/crypto/crypto.service.ts`:

```typescript
async function getNewExchangeBalances() {
  const client = new ccxt.newexchange({ apiKey, secret });
  const balance = await client.fetchBalance();
  return parseBalances(balance);
}
```

### Adjust Snapshot Schedule

Edit `backend/src/scheduler/snapshot.scheduler.ts`:

```typescript
@Cron('0 */6 * * *')  // Every 6 hours
async handleSnapshotCron() {
  // ...
}
```

### Custom Charts

Add to `frontend/app/components/`:

```tsx
export function MyCustomChart({ data }) {
  return <ResponsiveContainer>...</ResponsiveContainer>;
}
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot connect to Futu" | Make sure Futu OpenD is running on port 11111 |
| "Invalid API signature" | Check API key format in `secrets.json` |
| "Empty balances" | Verify API key has "Read" permission |
| "Database locked" | Stop PM2, delete `.db-wal` file, restart |

See [SETUP.md](./SETUP.md) for detailed troubleshooting.

---

## 📝 Contributing

This is a personal project template. Feel free to:
- Fork and customize for your needs
- Submit issues for bugs
- Share improvements via PR

---

## 📄 License

MIT License - Free for personal use

**Disclaimer:** This tool is for personal wealth tracking only. Always verify critical financial data against official exchange statements. The authors are not responsible for any financial decisions made based on this dashboard.

---

## 🙏 Acknowledgments

Built with:
- [NestJS](https://nestjs.com/) - Progressive Node.js framework
- [Next.js](https://nextjs.org/) - React framework
- [Futu OpenAPI](https://openapi.futunn.com/) - Stock market data
- [CCXT](https://github.com/ccxt/ccxt) - Crypto exchange library
- [Recharts](https://recharts.org/) - Charting library
- [TailwindCSS](https://tailwindcss.com/) - Utility-first CSS

---

**Made with ❤️ for personal finance tracking**

*Last updated: 2026-02-28*
