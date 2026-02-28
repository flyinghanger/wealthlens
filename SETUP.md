# 🚀 Wealth Dashboard V2 - Setup Guide

## ⚠️ IMPORTANT - Privacy & Security

This is a **template** with all sensitive data removed:
- ✅ No API keys or tokens
- ✅ No wallet addresses  
- ✅ No database with real balances
- ✅ No personal account information

**Before sharing this template, make sure you:**
- Removed all personal data from code
- Checked for hardcoded balances or account numbers
- Verified no sensitive info in Git history

---

## 📋 Prerequisites

1. **Node.js** >= 20.x
2. **Python** >= 3.9 (for Futu service)
3. **Futu OpenD** (for HK/US stock data)
4. **API Keys** from:
   - OKX (crypto exchange)
   - Binance (crypto exchange)
   - Optional: CoinGecko, DeBank for on-chain data

---

## 🔧 Step 1: Configure API Keys

### 1.1 Copy Example Config

```bash
cp config/secrets.example.json config/secrets.json
```

### 1.2 Fill in Your Keys

Edit `config/secrets.json`:

```json
{
  "okx": {
    "apiKey": "YOUR_OKX_API_KEY",
    "secret": "YOUR_OKX_SECRET",
    "password": "YOUR_OKX_PASSWORD",
    "webToken": "YOUR_OKX_WEB_TOKEN"  // Optional, for enhanced data
  },
  "binance": {
    "apiKey": "YOUR_BINANCE_API_KEY",
    "secret": "YOUR_BINANCE_SECRET"
  },
  "hyperliquid": {
    "wallet": "0xYourWalletAddress"  // For Hyperliquid perps
  },
  "defi_wallets": [
    {
      "name": "Main Wallet",
      "address": "0xYourAddress",
      "chains": ["eth", "bsc", "arbitrum", "optimism", "polygon", "base", "hyperevm"]
    }
  ]
}
```

**How to get API keys:**

- **OKX**: https://www.okx.com/account/my-api
  - Enable: "Read" permission
  - Optional: "Trade" if you want order data
- **Binance**: https://www.binance.com/en/my/settings/api-management
  - Enable: "Enable Reading"
- **Web Token (Optional)**: Use browser DevTools to extract from OKX website cookies

---

## 📦 Step 2: Install Dependencies

### Backend (NestJS)

```bash
cd backend
npm install
npm run build
```

### Frontend (Next.js)

```bash
cd frontend
npm install
```

### Futu Service (Python)

```bash
cd backend-futu
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

---

## 🎯 Step 3: Configure Futu OpenD

### 3.1 Download Futu OpenD

Download from: https://www.futunn.com/download/OpenAPI

### 3.2 Configure Connection

Edit `backend-futu/.env`:

```env
FUTU_HOST=127.0.0.1
FUTU_PORT=11111
```

### 3.3 Start OpenD

1. Open Futu OpenD desktop app
2. Login with your Futu account
3. Enable API port: **11111**

---

## 🚀 Step 4: Start Services

### Option A: Development Mode (Recommended for first-time setup)

```bash
# Terminal 1: Futu Service
cd backend-futu
source venv/bin/activate
python main.py

# Terminal 2: NestJS Backend
cd backend
npm run start:dev

# Terminal 3: Next.js Frontend
cd frontend
npm run dev
```

### Option B: Production Mode (with PM2)

```bash
# Install PM2 globally (if not installed)
npm install -g pm2

# Start all services
pm2 start ecosystem.config.js

# View logs
pm2 logs

# Check status
pm2 status

# Stop all
pm2 stop all
```

---

## 🌐 Access Dashboard

Open browser: **http://localhost:3000/dashboard**

Expected services:
- ✅ **Frontend**: http://localhost:3000
- ✅ **Backend API**: http://localhost:3001
- ✅ **Futu Service**: http://localhost:11112

---

## 🔍 Step 5: Verify Data Collection

### 5.1 Check API Health

```bash
# Backend health check
curl http://localhost:3001/health

# Assets summary
curl http://localhost:3001/api/assets/summary

# Latest snapshot
curl http://localhost:3001/api/history/latest
```

### 5.2 Initial Data Fetch

The system will automatically:
1. Connect to OKX, Binance, Futu on startup
2. Fetch account balances
3. Get market prices
4. Create first snapshot in database

**Database location:** `data/wealth.db`

### 5.3 Automatic Snapshots

By default, snapshots are created:
- **Every 6 hours** (configurable in `snapshot.scheduler.ts`)
- Or manually via: `POST http://localhost:3001/api/history/snapshot/collect`

---

## 🛠️ Troubleshooting

### Issue: "Cannot connect to Futu"

**Solution:**
1. Make sure Futu OpenD desktop app is running
2. Verify port 11111 is enabled in settings
3. Check firewall doesn't block localhost:11111

### Issue: "OKX API error: Invalid signature"

**Solution:**
1. Double-check API key, secret, and password
2. Ensure no extra spaces in `secrets.json`
3. Verify API key permissions include "Read"

### Issue: "Database locked"

**Solution:**
```bash
# Stop all services
pm2 stop all

# Delete lock file
rm data/wealth.db-shm data/wealth.db-wal

# Restart
pm2 start ecosystem.config.js
```

### Issue: "Empty wallet balances"

**Possible causes:**
1. API keys don't have "Read" permission
2. No actual balance in accounts
3. Network/firewall blocking API requests

**Debug:**
```bash
# Check backend logs
pm2 logs api-server

# Test API directly
curl http://localhost:3001/api/crypto/balances
```

---

## 📊 Understanding the Dashboard

### Main Sections

1. **Assets Overview**
   - Total net worth (USD)
   - Asset distribution pie chart
   - Top holdings table

2. **Crypto Portfolio**
   - Exchange balances (OKX, Binance, Hyperliquid)
   - DeFi wallet balances (on-chain)
   - Price changes (24h)

3. **Stocks**
   - Futu stock positions
   - US/HK market data
   - Dividend tracking

4. **Historical Trends**
   - Net worth growth chart
   - Asset allocation over time
   - Snapshot comparison

---

## 🔐 Security Best Practices

1. **Never commit `config/secrets.json` to Git**
   - Already in `.gitignore`
   - Use environment variables for production

2. **API Key Permissions**
   - Only enable "Read" permission
   - Never enable "Withdraw" or "Transfer"

3. **Firewall**
   - Block external access to ports 3000, 3001, 11112
   - Only allow localhost connections

4. **Backup Database**
   ```bash
   cp data/wealth.db data/wealth-backup-$(date +%Y%m%d).db
   ```

5. **Regular Key Rotation**
   - Rotate API keys every 3-6 months
   - Update `secrets.json` and restart services

---

## 📚 Project Structure

```
wealth-dashboard-v2/
├── backend/              # NestJS API server
│   ├── src/
│   │   ├── assets/       # Asset management
│   │   ├── crypto/       # Crypto exchange integrations
│   │   ├── futu/         # Stock data client
│   │   ├── snapshot/     # Snapshot system
│   │   └── ...
│   └── dist/             # Compiled JS (auto-generated)
├── backend-futu/         # Python Futu microservice
│   ├── main.py
│   └── venv/
├── frontend/             # Next.js dashboard
│   ├── app/
│   │   ├── dashboard/    # Main dashboard page
│   │   └── components/   # React components
│   └── public/
├── config/
│   ├── secrets.json      # ⚠️ YOUR API KEYS (gitignored)
│   └── secrets.example.json
├── data/
│   └── wealth.db         # SQLite database (auto-created)
└── ecosystem.config.js   # PM2 configuration
```

---

## 🚀 Next Steps

1. **Customize Assets**
   - Add manual entries in `data/feishu-manual.json`
   - Configure exchange fallback data

2. **Adjust Snapshot Schedule**
   - Edit `backend/src/scheduler/snapshot.scheduler.ts`
   - Default: Every 6 hours

3. **Add New Exchanges**
   - Extend `backend/src/crypto/crypto.service.ts`
   - Add new API integrations

4. **Customize UI**
   - Edit `frontend/app/dashboard/page.tsx`
   - Add new charts in `frontend/app/components/`

---

## 💬 Support

If you encounter issues:

1. Check logs: `pm2 logs`
2. Read backend README: `backend/README.md`
3. Review API endpoints: `http://localhost:3001/api`

---

## 📝 License

MIT License - Feel free to use and modify for personal use.

**Disclaimer:** This is a personal finance tracking tool. Always verify important financial data against official exchange statements.
