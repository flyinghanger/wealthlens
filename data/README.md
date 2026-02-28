# Data Directory

This folder is used to store:

1. **SQLite Database** (`wealth.db`) - Automatically created on first run
2. **Fallback Data** (optional) - Manual override files like:
   - `binance-fallback.json` - Binance balances fallback
   - `feishu-manual.json` - Manual asset entries

## Database Schema

The database will be auto-created by NestJS TypeORM on first startup.

**Main Tables:**
- `asset_snapshot` - Historical snapshots of all assets
- `crypto_balance` - Latest crypto balances
- `stock_position` - Latest stock positions
- `market_price` - Cached market prices

## First Time Setup

The database will be created automatically when you:
1. Configure API keys in `../config/secrets.json`
2. Start the backend: `npm run start:dev`
3. The system will fetch initial data and create the first snapshot

## Backup

Database backups are automatically created before major operations:
- Format: `wealth.db.bak-YYYYMMDD-HHMMSS`
- Keep important backups manually

## Privacy Note

⚠️ **Never commit `wealth.db` to Git!**

This database contains sensitive financial information. It's already in `.gitignore`.
