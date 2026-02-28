# 💰 WealthLens

A comprehensive **real-time wealth tracking dashboard** for:
- 📈 **Stocks** (US/HK via Futu)
- 💎 **Crypto** (CEX: OKX, Binance, Hyperliquid + DEX: On-chain wallets)
- 💵 **Cash & Others** (Manual entries)

**Live Demo Features:**
- Real-time asset aggregation from multiple sources
- Historical snapshots every 6 hours
- Beautiful charts & analytics
- Comparison view (day/week/month)
- Mobile-responsive UI

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
- **Futu Service**: Python + Futu OpenD
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

### 4. Open Dashboard

Visit: **http://localhost:3000/dashboard**

---

## 📖 Full Documentation

- **[SETUP.md](./SETUP.md)** - Complete setup guide with troubleshooting
- **[QUICKSTART.md](./QUICKSTART.md)** - Quick reference for common tasks
- **[AGENT_HANDOFF.md](./AGENT_HANDOFF.md)** - For AI agents to understand the system

---

## 🏗️ Architecture

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ HTTP
       ▼
┌─────────────┐     ┌──────────────┐
│  Next.js    │────▶│   NestJS     │
│  Frontend   │     │   Backend    │
│ :3000       │     │   :3001      │
└─────────────┘     └──────┬───────┘
                           │
                ┌──────────┼──────────┐
                │          │          │
                ▼          ▼          ▼
          ┌─────────┐ ┌───────┐ ┌─────────┐
          │  Futu   │ │  OKX  │ │ Binance │
          │ Service │ │  API  │ │   API   │
          │ :11112  │ │       │ │         │
          └─────────┘ └───────┘ └─────────┘
                │
                ▼
          ┌──────────┐
          │  Futu    │
          │  OpenD   │
          │  :11111  │
          └──────────┘
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
