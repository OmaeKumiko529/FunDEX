"""
FunDEX 股票数据采集脚本
======================
使用 AkShare 从东方财富获取A股行情数据，写入 SQLite 数据库。
支持命令行参数指定股票代码，也支持从 stock_list.txt 读取。

用法:
    python fetch_stock_data.py                          # 从 stock_list.txt 读取
    python fetch_stock_data.py 600519 000858             # 直接指定股票代码
    python fetch_stock_data.py --since 2025-01-01        # 仅拉取指定日期后的数据
    python fetch_stock_data.py --snapshot                # 仅获取实时快照

数据库: server/data/fundex.db（与 Node 后端共享，WAL 模式，读写不冲突）
"""

import argparse
import os
import re
import sqlite3
import sys
import time
from datetime import datetime, timedelta
from typing import Optional

import akshare as ak
import pandas as pd

# ─── 路径配置 ──────────────────────────────────

# 脚本所在目录 (server/)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# 数据库路径 (server/data/fundex.db)
DB_PATH = os.path.join(SCRIPT_DIR, "data", "fundex.db")
# 股票列表文件路径 (server/stock_list.txt)
STOCK_LIST_PATH = os.path.join(SCRIPT_DIR, "stock_list.txt")

# ─── 交易所映射 ──────────────────────────────
# 6 开头的沪市主板，0 开头深市主板/中小板，3 开头创业板，4/8 开头北交所
def detect_market(code: str) -> str:
    """根据股票代码前缀判定所属交易所"""
    if code.startswith("6"):
        return "sh"
    elif code.startswith(("0", "3")):
        return "sz"
    elif code.startswith(("4", "8")):
        return "bj"
    return "sz"  # 默认深市


# ─── 工具函数 ──────────────────────────────────


def parse_stock_list(filepath: str) -> list[str]:
    """
    从 stock_list.txt 读取股票代码列表。
    忽略空行和 # 开头的注释行；支持行内注释。
    """
    codes: list[str] = []
    if not os.path.exists(filepath):
        print(f"[WARN] 股票列表文件不存在: {filepath}")
        return codes

    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            # 移除行内注释（# 后面的内容）
            line = re.split(r"#", line)[0].strip()
            if not line:
                continue
            # 第一列是股票代码
            code = line.split()[0].strip()
            # 允许 6 位数字代码
            if code.isdigit() and len(code) == 6:
                codes.append(code)
    return codes


def parse_pct(value) -> Optional[float]:
    """
    将涨跌幅转为小数。
    AkShare 返回的涨跌幅可能是 "-3.12" 表示 -3.12%
    统一转为小数: -3.12 → -0.0312
    """
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    return round(float(value) / 100, 6)


def parse_volume(value) -> Optional[float]:
    """
    解析成交量。AkShare 实时行情成交量单位为"手"（1手=100股），
    历史日K中成交量单位为"股"。
    """
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    return round(float(value), 2)


def parse_amount(value) -> Optional[float]:
    """解析成交额（元）"""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    return round(float(value), 2)


# ─── AkShare 数据获取 ─────────────────────────


def fetch_stock_info(stock_code: str) -> Optional[dict]:
    """
    获取股票基本信息。
    返回: { stock_code, stock_name, market, industry, list_date } 或 None
    """
    try:
        # 获取 A 股代码及名称对照表（包含行业分类）
        df = ak.stock_info_a_code_name()
        row = df[df["code"] == stock_code]
        if row.empty:
            print(f"  [WARN] stock_code={stock_code} 未在股票列表中找到")
            return None
        r = row.iloc[0]
        name = str(r["name"])

        # 尝试获取行业分类信息
        industry = None
        list_date = None
        try:
            df_ind = ak.stock_individual_info_em(symbol=stock_code)
            if not df_ind.empty:
                # 提取行业
                ind_row = df_ind[df_ind["item"] == "行业"]
                if not ind_row.empty:
                    industry = str(ind_row.iloc[0]["value"])
                # 提取上市日期
                date_row = df_ind[df_ind["item"] == "上市日期"]
                if not date_row.empty:
                    list_date = str(date_row.iloc[0]["value"])
        except Exception:
            pass  # 非致命，基本信息仍然可用

        return {
            "stock_code": stock_code,
            "stock_name": name,
            "market": detect_market(stock_code),
            "industry": industry,
            "list_date": list_date,
        }
    except Exception as e:
        print(f"  [ERROR] 获取股票基本信息失败 ({stock_code}): {e}")
        return None


def fetch_hist_kline(
    stock_code: str, since_date: Optional[str] = None
) -> list[dict]:
    """
    获取A股历史日K行情数据（前复权）。

    返回: [{ stock_code, trade_date, open, high, low, close, volume, amount, change_pct, turnover_rate }, ...]
    """
    try:
        # 默认拉取最近一年的日K
        end_date = datetime.now().strftime("%Y%m%d")
        start_date = "19700101"
        if since_date:
            start_date = since_date.replace("-", "")

        df = ak.stock_zh_a_hist(
            symbol=stock_code,
            period="daily",
            start_date=start_date,
            end_date=end_date,
            adjust="qfq",  # 前复权
        )

        if df.empty:
            print(f"  [WARN] stock_code={stock_code} 日K数据为空")
            return []

        # 列名标准化
        df = df.rename(
            columns={
                "日期": "trade_date",
                "开盘": "open",
                "最高": "high",
                "最低": "low",
                "收盘": "close",
                "成交量": "volume",
                "成交额": "amount",
                "振幅": "amplitude",
                "涨跌幅": "change_pct",
                "涨跌额": "change",
                "换手率": "turnover_rate",
            }
        )
        df["trade_date"] = df["trade_date"].astype(str)

        if since_date:
            df = df[df["trade_date"] >= since_date]

        if df.empty:
            return []

        records: list[dict] = []
        for _, row in df.iterrows():
            records.append(
                {
                    "stock_code": stock_code,
                    "trade_date": row["trade_date"],
                    "open": round(float(row["open"]), 4) if pd.notna(row.get("open")) else None,
                    "high": round(float(row["high"]), 4) if pd.notna(row.get("high")) else None,
                    "low": round(float(row["low"]), 4) if pd.notna(row.get("low")) else None,
                    "close": round(float(row["close"]), 4) if pd.notna(row.get("close")) else None,
                    "volume": parse_volume(row.get("volume")),
                    "amount": parse_amount(row.get("amount")),
                    "change_pct": parse_pct(row.get("change_pct")),
                    "turnover_rate": parse_volume(row.get("turnover_rate")),
                }
            )
        return records

    except Exception as e:
        print(f"  [ERROR] 获取日K数据失败 ({stock_code}): {e}")
        return []


def fetch_snapshot(stock_codes: list[str]) -> list[dict]:
    """
    获取A股实时行情快照（最新价、涨跌幅、成交量等）。
    使用 ak.stock_zh_a_spot_em() 一次性获取全市场快照，
    然后按 codes 过滤。

    返回: [{ stock_code, stock_name, price, change, change_pct, volume, amount, ... }]
    """
    try:
        df = ak.stock_zh_a_spot_em()
        if df.empty:
            print("[WARN] 实时行情数据为空")
            return []

        df = df.rename(
            columns={
                "代码": "stock_code",
                "名称": "stock_name",
                "最新价": "price",
                "涨跌额": "change",
                "涨跌幅": "change_pct",
                "成交量": "volume",
                "成交额": "amount",
                "今开": "open",
                "最高": "high",
                "最低": "low",
                "昨收": "prev_close",
                "换手率": "turnover_rate",
                "市盈率-动态": "pe",
                "总市值": "market_cap",
            }
        )

        # 过滤需要的股票（如果指定）
        code_set = {c for c in stock_codes}
        if code_set:
            df = df[df["stock_code"].isin(code_set)]

        if df.empty:
            return []

        records: list[dict] = []
        for _, row in df.iterrows():
            code = str(row["stock_code"]).zfill(6)
            records.append(
                {
                    "stock_code": code,
                    "stock_name": str(row.get("stock_name", "")),
                    "price": round(float(row["price"]), 2) if pd.notna(row.get("price")) else None,
                    "change": round(float(row["change"]), 3) if pd.notna(row.get("change")) else None,
                    "change_pct": parse_pct(row.get("change_pct")),
                    "volume": parse_volume(row.get("volume")),
                    "amount": parse_amount(row.get("amount")),
                    "open": round(float(row["open"]), 2) if pd.notna(row.get("open")) else None,
                    "high": round(float(row["high"]), 2) if pd.notna(row.get("high")) else None,
                    "low": round(float(row["low"]), 2) if pd.notna(row.get("low")) else None,
                    "prev_close": round(float(row["prev_close"]), 2) if pd.notna(row.get("prev_close")) else None,
                    "turnover_rate": parse_volume(row.get("turnover_rate")),
                    "pe": round(float(row["pe"]), 2) if pd.notna(row.get("pe")) else None,
                    "market_cap": round(float(row["market_cap"]), 2) if pd.notna(row.get("market_cap")) else None,
                }
            )
        return records

    except Exception as e:
        print(f"[ERROR] 获取实时行情失败: {e}")
        return []


# ─── 数据库写入 ────────────────────────────────


def ensure_tables(conn: sqlite3.Connection):
    """确保股票相关表存在（幂等）"""
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS stock_info (
            stock_code TEXT PRIMARY KEY,
            stock_name TEXT NOT NULL,
            market TEXT,
            industry TEXT,
            list_date TEXT,
            is_active INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS stock_daily (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            stock_code TEXT NOT NULL,
            trade_date TEXT NOT NULL,
            open REAL,
            high REAL,
            low REAL,
            close REAL,
            volume REAL,
            amount REAL,
            change_pct REAL,
            turnover_rate REAL,
            FOREIGN KEY (stock_code) REFERENCES stock_info(stock_code),
            UNIQUE (stock_code, trade_date)
        );

        CREATE INDEX IF NOT EXISTS idx_stock_daily_code_date ON stock_daily(stock_code, trade_date);
    """)
    conn.commit()


def upsert_stock_info(conn: sqlite3.Connection, info: dict) -> int:
    """写入或更新股票基本信息，返回影响行数"""
    if not info:
        return 0
    cursor = conn.execute(
        "INSERT OR REPLACE INTO stock_info (stock_code, stock_name, market, industry, list_date, is_active) VALUES (?, ?, ?, ?, ?, 1)",
        (info["stock_code"], info["stock_name"], info["market"], info["industry"], info["list_date"]),
    )
    return cursor.rowcount


def upsert_stock_daily_batch(conn: sqlite3.Connection, records: list[dict]) -> int:
    """批量写入日K数据（幂等），返回影响行数"""
    if not records:
        return 0
    total = 0
    for rec in records:
        cursor = conn.execute(
            """INSERT OR REPLACE INTO stock_daily
               (stock_code, trade_date, open, high, low, close, volume, amount, change_pct, turnover_rate)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                rec["stock_code"],
                rec["trade_date"],
                rec["open"],
                rec["high"],
                rec["low"],
                rec["close"],
                rec["volume"],
                rec["amount"],
                rec["change_pct"],
                rec["turnover_rate"],
            ),
        )
        total += cursor.rowcount
    return total


# ─── 主流程 ────────────────────────────────────


def process_one_stock(
    conn: sqlite3.Connection,
    stock_code: str,
    since_date: Optional[str] = None,
) -> tuple[int, int]:
    """
    处理单只股票：获取基本信息 + 历史日K → 写入数据库。
    返回: (info_rows, daily_rows)
    """
    print(f"\n▶ 处理股票 {stock_code} ...")

    # 1. 获取基本信息
    info = fetch_stock_info(stock_code)
    if info:
        info_rows = upsert_stock_info(conn, info)
        print(f"  ✓ 股票信息: {info['stock_name']} ({info['market']}) 行业: {info['industry'] or '未知'}")
    else:
        info_rows = 0
        print(f"  ⚠ 未能获取股票信息")
        # 如果基本信息都获取不到，后面的 K 线也没必要拿了
        return (info_rows, 0)

    # 2. 获取历史日K
    daily_records = fetch_hist_kline(stock_code, since_date)
    if daily_records:
        daily_rows = upsert_stock_daily_batch(conn, daily_records)
        print(f"  ✓ 日K行情: 获取 {len(daily_records)} 条, 写入 {daily_rows} 条")
    else:
        daily_rows = 0
        print(f"  ⚠ 未获取到日K行情数据")

    conn.commit()
    return (info_rows, daily_rows)


def do_snapshot(
    conn: sqlite3.Connection,
    stock_codes: list[str],
) -> list[dict]:
    """
    获取实时行情快照并打印。
    快照数据不会写入数据库（因为是瞬时数据）。
    """
    print(f"\n▶ 获取 {len(stock_codes)} 只股票实时行情 ...")
    snapshots = fetch_snapshot(stock_codes)

    if not snapshots:
        print("  ⚠ 未获取到实时行情")
        return snapshots

    print(f"  ✓ 获取 {len(snapshots)} 只股票行情:")
    print(f"  {'代码':<8} {'名称':<10} {'最新价':>8} {'涨跌幅':>8} {'涨跌额':>8} {'成交额(亿)':>10} {'换手率':>8}")
    print(f"  {'-'*60}")
    for s in snapshots:
        change_pct = f"{s['change_pct']*100:.2f}%" if s['change_pct'] is not None else "N/A"
        change = f"{s['change']:+.2f}" if s['change'] is not None else "N/A"
        amount_yi = s['amount'] / 100_000_000 if s['amount'] else 0
        turnover = f"{s['turnover_rate']:.2f}%" if s['turnover_rate'] is not None else "N/A"
        print(f"  {s['stock_code']:<8} {s['stock_name']:<10} {s['price']:>8.2f} {change_pct:>8} {change:>8} {amount_yi:>10.2f} {turnover:>8}")

    return snapshots


def main():
    parser = argparse.ArgumentParser(
        description="FundEx 股票数据采集脚本 - 使用 AkShare 获取 A 股行情并写入 SQLite",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python fetch_stock_data.py                           # 从 stock_list.txt 读取
  python fetch_stock_data.py 600519 000858              # 手动指定股票代码
  python fetch_stock_data.py --since 2025-01-01         # 仅拉取 2025-01-01 后的数据
  python fetch_stock_data.py 600519 --since 2025-01-01  # 组合使用
  python fetch_stock_data.py --snapshot                 # 仅获取实时快照（不写入 DB）
        """,
    )
    parser.add_argument(
        "codes",
        nargs="*",
        help="股票代码列表（空格分隔），不指定则从 stock_list.txt 读取",
    )
    parser.add_argument(
        "--since",
        type=str,
        default=None,
        help="起始日期 (YYYY-MM-DD)，仅拉取该日期后的日K数据",
    )
    parser.add_argument(
        "--snapshot",
        action="store_true",
        help="仅获取实时快照（不写入 DB）",
    )
    args = parser.parse_args()

    # ── 获取股票代码列表 ──
    if args.codes:
        stock_codes = [c.zfill(6) for c in args.codes]
        print(f"[INFO] 使用命令行参数指定的 {len(stock_codes)} 只股票")
    else:
        stock_codes = parse_stock_list(STOCK_LIST_PATH)
        print(f"[INFO] 从 {STOCK_LIST_PATH} 读取到 {len(stock_codes)} 只股票")

    if not stock_codes:
        print("[ERROR] 未指定任何股票代码！")
        sys.exit(1)

    # ── 显示模式 ──
    if args.snapshot:
        print(f"[INFO] 模式: 实时快照（仅读取，不写入 DB）")
    elif args.since:
        print(f"[INFO] 日K日期范围: {args.since} ~ 今天")
    else:
        print(f"[INFO] 日K日期范围: 全量历史")

    # ── 连接数据库 ──
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    ensure_tables(conn)
    print(f"[INFO] 数据库: {DB_PATH}")

    if args.snapshot:
        # ── 仅实时快照模式 ──
        do_snapshot(conn, stock_codes)
        conn.close()
        return

    # ── 逐一抓取历史数据 ──
    total_info = 0
    total_daily = 0
    success_count = 0
    fail_count = 0
    start_time = time.time()

    for idx, code in enumerate(stock_codes, 1):
        print(f"\n[{idx}/{len(stock_codes)}] ", end="")
        try:
            info_rows, daily_rows = process_one_stock(conn, code, args.since)
            total_info += info_rows
            total_daily += daily_rows
            if info_rows > 0 or daily_rows > 0:
                success_count += 1
            else:
                fail_count += 1
            # 避免请求过快触发风控
            if idx < len(stock_codes):
                time.sleep(0.5)
        except KeyboardInterrupt:
            print("\n[INFO] 用户中断")
            break
        except Exception as e:
            print(f"  [ERROR] 处理股票 {code} 时发生未预期异常: {e}")
            fail_count += 1

    # ── 统计 ──
    elapsed = time.time() - start_time
    conn.close()

    print(f"\n{'='*50}")
    print(f"  采集完成!")
    print(f"  ⏱  耗时: {elapsed:.1f} 秒")
    print(f"  📊 处理股票: {success_count + fail_count} 只")
    print(f"     ✅ 成功: {success_count} 只")
    print(f"     ❌ 失败: {fail_count} 只")
    print(f"  📝 写入 stock_info: {total_info} 条")
    print(f"  📝 写入 stock_daily: {total_daily} 条")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()