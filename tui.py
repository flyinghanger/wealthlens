#!/usr/bin/env python3
"""
WealthLens TUI - 终端资产看板
用法: python tui.py [--watch] [--interval 60]
"""
import sys, json, time, argparse
from datetime import datetime
import urllib.request

API = "http://localhost:3001"

def fetch(path, timeout=70):
    try:
        with urllib.request.urlopen(f"{API}{path}", timeout=timeout) as r:
            return json.load(r)
    except Exception as e:
        return None

def fmt_usd(v): return f"${v:>12,.0f}"
def fmt_cny(v): return f"¥{v:>12,.0f}"
def fmt_pct(v):
    s = f"{v:+.2f}%"
    return f"\033[32m{s}\033[0m" if v >= 0 else f"\033[31m{s}\033[0m"
def fmt_pnl(v):
    s = fmt_usd(v)
    return f"\033[32m{s}\033[0m" if v >= 0 else f"\033[31m{s}\033[0m"

def clear(): print("\033[2J\033[H", end="")

def render(snap, crypto):
    rates = snap.get("rates", {})
    cny = rates.get("usd_to_cny", 7.25)
    funds = snap.get("funds", {})
    positions = snap.get("stocks", {}).get("positions", [])
    futu = [p for p in positions if p.get("source") == "futu"]
    ibkr = [p for p in positions if p.get("source") == "ibkr"]
    futu_total = sum(p["market_val_usd"] for p in futu)
    ibkr_total = sum(p["market_val_usd"] for p in ibkr)
    ibkr_net = funds.get("ibkr_net_liquidation", ibkr_total)
    futu_cash = funds.get("cash_usd", 0) - funds.get("ibkr_cash_usd", 0)
    ibkr_cash = funds.get("ibkr_cash_usd", 0)

    by_ex = {}
    for p in (crypto or []):
        by_ex.setdefault(p["exchange"], 0)
        by_ex[p["exchange"]] += p["value_usd"]
    crypto_total = sum(by_ex.values())

    grand = futu_total + (ibkr_net or ibkr_total) + futu_cash + ibkr_cash + crypto_total

    W = 60
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    print("=" * W)
    print(f"  💰 WealthLens  |  {now}")
    print("=" * W)

    # 汇总
    print(f"\n  {'类别':<16} {'USD':>13} {'CNY':>13}")
    print(f"  {'-'*44}")
    rows = [
        ("🟠 Futu 持仓", futu_total),
        ("🔵 IBKR 净值", ibkr_net),
        ("  Futu 现金", futu_cash),
        ("  IBKR 现金", ibkr_cash),
    ]
    for ex, val in sorted(by_ex.items(), key=lambda x: -x[1]):
        emoji = {"OKX":"🔶","Binance":"🟡","Bitget":"⬛"}.get(ex, "🔷")
        rows.append((f"{emoji} {ex}", val))
    for label, val in rows:
        print(f"  {label:<16} {fmt_usd(val)} {fmt_cny(val * cny)}")
    print(f"  {'-'*44}")
    print(f"  {'💰 总资产':<16} \033[1m{fmt_usd(grand)}\033[0m {fmt_cny(grand * cny)}")

    # Futu 持仓
    if futu:
        print(f"\n  ── 🟠 Futu 持仓 {'─'*30}")
        print(f"  {'股票':<18} {'市值':>10} {'盈亏':>10} {'24h%':>8}")
        for p in sorted(futu, key=lambda x: -x["market_val_usd"]):
            name = p["stock_name"][:16]
            print(f"  {name:<18} {fmt_usd(p['market_val_usd'])[1:]:>10} "
                  f"{fmt_pnl(p['pl_val_usd'])[:-4]:>10}  "
                  f"{fmt_pct(p.get('price_change_24h_percent',0)):>8}")

    # IBKR 持仓
    if ibkr:
        print(f"\n  ── 🔵 IBKR 持仓 {'─'*30}")
        print(f"  {'股票':<18} {'市值':>10} {'盈亏':>10} {'24h%':>8}")
        for p in sorted(ibkr, key=lambda x: -x["market_val_usd"]):
            name = p["stock_name"][:16]
            print(f"  {name:<18} {fmt_usd(p['market_val_usd'])[1:]:>10} "
                  f"{fmt_pnl(p['pl_val_usd'])[:-4]:>10}  "
                  f"{fmt_pct(p.get('price_change_24h_percent',0)):>8}")

    # 加密
    if crypto:
        print(f"\n  ── 🔶 加密资产 {'─'*31}")
        print(f"  {'交易所':<10} {'币种':<8} {'类型':<8} {'市值':>10}")
        for p in sorted(crypto, key=lambda x: -x["value_usd"]):
            print(f"  {p['exchange']:<10} {p['symbol']:<8} {p.get('type',''):8} {fmt_usd(p['value_usd'])[1:]:>10}")

    print(f"\n  汇率: USD/CNY {cny:.4f}  |  按 Ctrl+C 退出")
    print("=" * W)

def main():
    parser = argparse.ArgumentParser(description="WealthLens TUI")
    parser.add_argument("--watch", action="store_true", help="持续刷新")
    parser.add_argument("--interval", type=int, default=60, help="刷新间隔（秒）")
    args = parser.parse_args()

    while True:
        if args.watch:
            clear()
        print("  ⏳ 拉取数据中...")
        snap = fetch("/api/assets/snapshot")
        crypto = fetch("/api/crypto", timeout=60)
        if not snap:
            print("  ❌ 无法连接 backend (http://localhost:3001)")
            sys.exit(1)
        if args.watch:
            clear()
        render(snap, crypto or [])
        if not args.watch:
            break
        time.sleep(args.interval)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n  再见！")
