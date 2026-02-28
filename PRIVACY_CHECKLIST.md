# 🔐 Privacy & Security Checklist

## ✅ Template Safety Checks

This template has been sanitized to remove all sensitive data:

### Removed Items
- [x] `config/secrets.json` - Real API keys deleted
- [x] `data/*.db` - Real database deleted
- [x] `data/*.csv` - Personal data files deleted
- [x] `.env` files - Environment variables cleaned
- [x] `.git/` - Git history removed
- [x] `node_modules/` - Dependencies excluded
- [x] `venv/` - Python virtual env excluded
- [x] `dist/`, `.next/` - Build artifacts excluded
- [x] `logs/` - Log files excluded

### Code Scanned
- [x] No hardcoded API keys in source code
- [x] No hardcoded wallet addresses in source code
- [x] No hardcoded account balances in source code
- [x] No personal information in comments

### Remaining Safe Files
- [x] `config/secrets.example.json` - Template only (fake values)
- [x] `data/README.md` - Instructions only
- [x] Source code (`.ts`, `.tsx`, `.js`) - Generic implementation
- [x] Documentation (`.md`) - No personal data

---

## ⚠️ Before Sharing This Template

### Step 1: Final Verification

Run these commands to double-check:

```bash
# Search for potential API keys (should return nothing)
grep -r "apiKey\|api_key\|API_KEY" --include="*.json" config/

# Search for wallet addresses (should return nothing)
grep -r "0x[a-fA-F0-9]{40}" --include="*.ts" --include="*.js" backend/ frontend/

# Search for large numbers that might be balances (review carefully)
grep -r "[0-9]{6,}" --include="*.ts" --include="*.tsx" frontend/app/

# Check secrets.json doesn't exist
test -f config/secrets.json && echo "⚠️ WARNING: secrets.json still exists!" || echo "✅ Safe"

# Check database doesn't exist
test -f data/wealth.db && echo "⚠️ WARNING: wealth.db still exists!" || echo "✅ Safe"
```

### Step 2: Review Output

**Expected results:**
- `config/secrets.example.json` - Should only contain placeholder values
- No `.db` files in `data/`
- No real API keys anywhere
- Generic code only

### Step 3: Check Recipient Instructions

Ensure they know to:
1. **Create their own `secrets.json`** from the example
2. **Never commit `secrets.json` to Git**
3. **Keep their database local only**
4. **Use read-only API keys**

---

## 🔒 Recipient Setup Security

### For the Person Receiving This Template

**IMPORTANT - Read Before Setup:**

1. **API Key Permissions**
   - ⚠️ ONLY use "Read" permission
   - ❌ NEVER enable "Withdraw", "Transfer", or "Trade"
   - 🔄 Rotate keys every 3-6 months

2. **Network Security**
   - 🔒 Run on localhost or secure VPN only
   - ❌ DO NOT expose ports to public internet
   - 🛡️ Use firewall to block external access

3. **Data Privacy**
   - 💾 Regular database backups
   - 🗑️ Secure deletion when done (not just trash)
   - 🔐 Encrypt backup files

4. **Git Safety**
   ```bash
   # Before your first commit, verify .gitignore:
   cat .gitignore | grep -E "secrets.json|wealth.db|.env"
   
   # Should show:
   # config/secrets.json
   # data/*.db
   # **/.env
   ```

---

## 🚨 If You Accidentally Leaked Secrets

### Immediate Actions

1. **Rotate all API keys immediately**
   - OKX: https://www.okx.com/account/my-api
   - Binance: https://www.binance.com/en/my/settings/api-management

2. **Check for unauthorized activity**
   - Review API access logs
   - Check for unexpected trades
   - Verify wallet balances

3. **Remove from Git if committed**
   ```bash
   # Remove secrets from Git history (if already committed)
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch config/secrets.json" \
     --prune-empty --tag-name-filter cat -- --all
   
   # Force push (if pushed to remote)
   git push origin --force --all
   ```

4. **Invalidate old keys**
   - Delete compromised API keys from exchange
   - Generate new ones with same permissions

---

## 📋 Final Checklist Before Sharing

- [ ] Ran all verification commands above
- [ ] Reviewed search results (no real data found)
- [ ] Checked `config/` folder (only .example files)
- [ ] Checked `data/` folder (no .db files)
- [ ] Removed `.git/` folder
- [ ] Updated README with generic examples
- [ ] Tested that recipient can follow SETUP.md from scratch

---

## ✅ Ready to Share

If all checks passed:

```bash
# Create clean archive
cd ~/Documents
tar -czf wealth-dashboard-v2-template.tar.gz wealth-dashboard-v2-template/

# Or ZIP
zip -r wealth-dashboard-v2-template.zip wealth-dashboard-v2-template/ \
  -x "*/node_modules/*" "*/venv/*" "*/.next/*" "*/dist/*"
```

**Share:**
- ✅ `wealth-dashboard-v2-template.tar.gz`
- ✅ Tell them to read `SETUP.md` first
- ✅ Remind them NEVER to commit `secrets.json`

---

**Last verified:** 2026-02-16  
**Template version:** 2.0 (De-sensitized)
