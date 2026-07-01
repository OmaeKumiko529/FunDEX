"""
FundEx 数据采集脚本
====================
使用 AkShare 从东方财富获取基金数据，写入 SQLite 数据库。
支持命令行参数指定基金代码，也支持从 fund_list.txt 读取。

用法:
    python fetch_fund_data.py                          # 从 fund_list.txt 读取
    python fetch_fund_data.py 000001 110011 161725      # 直接指定基金代码
    python fetch_fund_data.py --since 2024-01-01        # 仅拉取指定日期后的数据

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
# 基金列表文件路径 (server/fund_list.txt)
FUND_LIST_PATH = os.path.join(SCRIPT_DIR, "fund_list.txt")

# ─── ETF/LOF 判定关键字 ──────────────────────
ETF_KEYWORDS = ["LOF", "指数型-股票", "指数型-海外"]
# ETF 关键字单独处理（排除 "联接" 基金，它们是场外品种）
ETF_KEYWORD = "ETF"


def is_etf_lof(fund_type: str | None) -> bool:
    """判断是否为场内可交易品种（ETF/LOF）
    
    规则：
    - 基金类型含 "LOF" → 场内 ✅
    - 基金类型含 "ETF" 且不含 "联接" → 场内 ✅
    - 基金类型含 "指数型-股票" / "指数型-海外" → 场内 ✅（指数LOF）
    - 其他 → 场外 ❌
    """
    if not fund_type:
        return False
    for kw in ETF_KEYWORDS:
        if kw in fund_type:
            return True
    # ETF 需要排除 "联接" 基金（场外品种）
    if ETF_KEYWORD in fund_type and "联接" not in fund_type:
        return True
    return False


# ─── 工具函数 ──────────────────────────────────


def parse_fund_list(filepath: str) -> list[str]:
    """
    从 fund_list.txt 读取基金代码列表。
    忽略空行和 # 开头的注释行；支持行内注释。
    """
    codes: list[str] = []
    if not os.path.exists(filepath):
        print(f"[WARN] 基金列表文件不存在: {filepath}")
        return codes

    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            # 移除行内注释（# 后面的内容）
            line = re.split(r"#", line)[0].strip()
            if not line:
                continue
            # 第一列是基金代码
            code = line.split()[0].strip()
            if code.isdigit():
                codes.append(code)
    return codes


def parse_growth_rate(value) -> Optional[float]:
    """
    将日增长率转为小数。
    AkShare 可能返回字符串 "0.50%" 或数值 0.5。
    统一转为小数: 0.50% → 0.005, 数值 0.5 → 0.5
    """
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, str):
        value = value.replace("%", "").strip()
        try:
            return round(float(value) / 100, 6)
        except (ValueError, TypeError):
            return None
    # 已经是数值（AkShare 日增长率为百分比数值，如 -3.1 表示 -3.1%）
    # 统一除以 100 转为小数
    return round(float(value) / 100, 6)


# ─── AkShare 数据获取 ─────────────────────────


def fetch_fund_basic_info(fund_code: str) -> Optional[dict]:
    """
    获取基金基本信息。
    返回: { fund_code, fund_name, fund_type } 或 None
    """
    try:
        df = ak.fund_name_em()
        row = df[df["基金代码"] == fund_code]
        if row.empty:
            print(f"  [WARN] fund_code={fund_code} 未在基金列表中找到")
            return None
        r = row.iloc[0]
        return {
            "fund_code": str(r["基金代码"]).zfill(6),
            "fund_name": str(r["基金简称"]),
            "fund_type": str(r["基金类型"]) if pd.notna(r["基金类型"]) else None,
        }
    except Exception as e:
        print(f"  [ERROR] 获取基金基本信息失败 ({fund_code}): {e}")
        return None


def fetch_nav_history(fund_code: str, since_date: Optional[str] = None) -> list[dict]:
    """
    获取基金历史净值数据。
    合并单位净值走势和累计净值走势两个接口。

    返回: [{ fund_code, nav_date, unit_nav, accum_nav, daily_growth_rate }, ...]
    """
    try:
        # 1. 获取单位净值 + 日增长率
        df_unit = ak.fund_open_fund_info_em(
            symbol=fund_code, indicator="单位净值走势"
        )
        if df_unit.empty:
            print(f"  [WARN] fund_code={fund_code} 单位净值数据为空")
            return []

        # 标准化列名
        df_unit = df_unit.rename(
            columns={
                "净值日期": "nav_date",
                "单位净值": "unit_nav",
                "日增长率": "daily_growth_rate",
            }
        )
        df_unit["nav_date"] = df_unit["nav_date"].astype(str)

        # 2. 获取累计净值
        df_accum = ak.fund_open_fund_info_em(
            symbol=fund_code, indicator="累计净值走势"
        )
        if not df_accum.empty:
            df_accum = df_accum.rename(
                columns={"净值日期": "nav_date", "累计净值": "accum_nav"}
            )
            df_accum["nav_date"] = df_accum["nav_date"].astype(str)
            # 合并到主表
            df_unit = df_unit.merge(
                df_accum[["nav_date", "accum_nav"]], on="nav_date", how="left"
            )
        else:
            df_unit["accum_nav"] = None

        # 3. 日期筛选
        if since_date:
            df_unit = df_unit[df_unit["nav_date"] >= since_date]

        if df_unit.empty:
            return []

        # 4. 转为 dict 列表
        records: list[dict] = []
        for _, row in df_unit.iterrows():
            unit_nav = row["unit_nav"]
            if pd.isna(unit_nav):
                continue  # 跳过无效数据
            records.append(
                {
                    "fund_code": fund_code,
                    "nav_date": row["nav_date"],
                    "unit_nav": round(float(unit_nav), 4),
                    "accum_nav": round(float(row["accum_nav"]), 4)
                    if pd.notna(row.get("accum_nav"))
                    else None,
                    "daily_growth_rate": parse_growth_rate(
                        row.get("daily_growth_rate")
                    ),
                }
            )

        return records

    except Exception as e:
        print(f"  [ERROR] 获取净值数据失败 ({fund_code}): {e}")
        return []


def fetch_etf_market(fund_code: str, since_date: Optional[str] = None) -> list[dict]:
    """
    获取 ETF/LOF 日K 行情数据（前复权）。
    非 ETF/LOF 基金返回空列表。

    返回: [{ fund_code, trade_date, open, high, low, close, volume, amount, change_pct }, ...]
    """
    try:
        df = ak.fund_etf_hist_em(symbol=fund_code, period="daily", adjust="qfq")
        if df.empty:
            return []

        df = df.rename(
            columns={
                "日期": "trade_date",
                "开盘": "open",
                "最高": "high",
                "最低": "low",
                "收盘": "close",
                "成交量": "volume",
                "成交额": "amount",
                "涨跌幅": "change_pct",
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
                    "fund_code": fund_code,
                    "trade_date": row["trade_date"],
                    "open": round(float(row["open"]), 4) if pd.notna(row.get("open")) else None,
                    "high": round(float(row["high"]), 4) if pd.notna(row.get("high")) else None,
                    "low": round(float(row["low"]), 4) if pd.notna(row.get("low")) else None,
                    "close": round(float(row["close"]), 4) if pd.notna(row.get("close")) else None,
                    "volume": round(float(row["volume"]), 2) if pd.notna(row.get("volume")) else None,
                    "amount": round(float(row["amount"]), 2) if pd.notna(row.get("amount")) else None,
                    "change_pct": parse_growth_rate(row.get("change_pct")),
                }
            )
        return records

    except Exception:
        # 非 ETF/LOF 会抛异常，静默返回空
        return []


# ─── 数据库写入 ────────────────────────────────


def ensure_tables(conn: sqlite3.Connection):
    """确保表存在（幂等）"""
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS fund_info (
            fund_code TEXT PRIMARY KEY,
            fund_name TEXT NOT NULL,
            fund_type TEXT,
            is_traded INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS fund_nav (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fund_code TEXT NOT NULL,
            nav_date TEXT NOT NULL,
            unit_nav REAL NOT NULL,
            accum_nav REAL,
            daily_growth_rate REAL,
            FOREIGN KEY (fund_code) REFERENCES fund_info(fund_code),
            UNIQUE (fund_code, nav_date)
        );

        CREATE TABLE IF NOT EXISTS fund_market (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fund_code TEXT NOT NULL,
            trade_date TEXT NOT NULL,
            open REAL,
            high REAL,
            low REAL,
            close REAL,
            volume REAL,
            amount REAL,
            change_pct REAL,
            FOREIGN KEY (fund_code) REFERENCES fund_info(fund_code),
            UNIQUE (fund_code, trade_date)
        );

        CREATE INDEX IF NOT EXISTS idx_fund_nav_code_date ON fund_nav(fund_code, nav_date);
        CREATE INDEX IF NOT EXISTS idx_fund_market_code_date ON fund_market(fund_code, trade_date);
    """)
    # 兼容旧数据库：添加 is_traded 列
    try:
        conn.execute("ALTER TABLE fund_info ADD COLUMN is_traded INTEGER DEFAULT 0")
    except Exception:
        pass
    conn.commit()


def upsert_fund_info(conn: sqlite3.Connection, info: dict, is_traded: int = 0) -> int:
    """写入或更新基金基本信息，返回影响行数"""
    if not info:
        return 0
    cursor = conn.execute(
        "INSERT OR REPLACE INTO fund_info (fund_code, fund_name, fund_type, is_traded) VALUES (?, ?, ?, ?)",
        (info["fund_code"], info["fund_name"], info["fund_type"], is_traded),
    )
    return cursor.rowcount


def upsert_fund_nav_batch(conn: sqlite3.Connection, records: list[dict]) -> int:
    """批量写入净值数据（幂等），返回影响行数"""
    if not records:
        return 0
    total = 0
    for rec in records:
        cursor = conn.execute(
            """INSERT OR REPLACE INTO fund_nav
               (fund_code, nav_date, unit_nav, accum_nav, daily_growth_rate)
               VALUES (?, ?, ?, ?, ?)""",
            (
                rec["fund_code"],
                rec["nav_date"],
                rec["unit_nav"],
                rec["accum_nav"],
                rec["daily_growth_rate"],
            ),
        )
        total += cursor.rowcount
    return total


def upsert_fund_market_batch(conn: sqlite3.Connection, records: list[dict]) -> int:
    """批量写入日K数据（幂等），返回影响行数"""
    if not records:
        return 0
    total = 0
    for rec in records:
        cursor = conn.execute(
            """INSERT OR REPLACE INTO fund_market
               (fund_code, trade_date, open, high, low, close, volume, amount, change_pct)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                rec["fund_code"],
                rec["trade_date"],
                rec["open"],
                rec["high"],
                rec["low"],
                rec["close"],
                rec["volume"],
                rec["amount"],
                rec["change_pct"],
            ),
        )
        total += cursor.rowcount
    return total


# ─── 主流程 ────────────────────────────────────


def process_one_fund(
    conn: sqlite3.Connection,
    fund_code: str,
    since_date: Optional[str] = None,
) -> tuple[int, int, int]:
    """
    处理单只基金：获取信息+净值+行情 → 写入数据库。
    返回: (info_rows, nav_rows, market_rows)
    """
    print(f"\n▶ 处理基金 {fund_code} ...")

    # 1. 获取基本信息
    info = fetch_fund_basic_info(fund_code)
    if info:
        etf = 1 if is_etf_lof(info["fund_type"]) else 0
        info_rows = upsert_fund_info(conn, info, etf)
        print(f"  ✓ 基金信息: {info['fund_name']} ({info['fund_type']}) {'[ETF/LOF]' if etf else '[场外]'}")
    else:
        info_rows = 0
        etf = 0
        print(f"  ⚠ 未能获取基金信息")

    # 2. 获取净值数据
    nav_records = fetch_nav_history(fund_code, since_date)
    if nav_records:
        nav_rows = upsert_fund_nav_batch(conn, nav_records)
        print(f"  ✓ 净值数据: 获取 {len(nav_records)} 条, 写入 {nav_rows} 条")
    else:
        nav_rows = 0
        print(f"  ⚠ 未获取到净值数据")

    # 3. 如是 ETF/LOF，获取日K行情数据
    market_rows = 0
    if etf:
        market_records = fetch_etf_market(fund_code, since_date)
        if market_records:
            market_rows = upsert_fund_market_batch(conn, market_records)
            print(f"  ✓ 日K行情: 获取 {len(market_records)} 条, 写入 {market_rows} 条")
        else:
            print(f"  ⚠ 未获取到日K行情数据")

    conn.commit()
    return (info_rows, nav_rows, market_rows)


def main():
    parser = argparse.ArgumentParser(
        description="FundEx 数据采集脚本 - 使用 AkShare 获取基金数据并写入 SQLite",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python fetch_fund_data.py                           # 从 fund_list.txt 读取
  python fetch_fund_data.py 000001 110011              # 手动指定基金代码
  python fetch_fund_data.py --since 2024-06-01          # 仅拉取 2024-06-01 后的数据
  python fetch_fund_data.py 000001 --since 2025-01-01   # 组合使用
        """,
    )
    parser.add_argument(
        "codes",
        nargs="*",
        help="基金代码列表（空格分隔），不指定则从 fund_list.txt 读取",
    )
    parser.add_argument(
        "--since",
        type=str,
        default=None,
        help="起始日期 (YYYY-MM-DD)，仅拉取该日期后的净值数据",
    )
    args = parser.parse_args()

    # ── 获取基金代码列表 ──
    if args.codes:
        fund_codes = args.codes
        print(f"[INFO] 使用命令行参数指定的 {len(fund_codes)} 只基金")
    else:
        fund_codes = parse_fund_list(FUND_LIST_PATH)
        print(f"[INFO] 从 {FUND_LIST_PATH} 读取到 {len(fund_codes)} 只基金")

    if not fund_codes:
        print("[ERROR] 未指定任何基金代码！")
        sys.exit(1)

    # ── 显示日期范围 ──
    if args.since:
        print(f"[INFO] 净值日期范围: {args.since} ~ 今天")
    else:
        print(f"[INFO] 净值日期范围: 全量历史")

    # ── 连接数据库 ──
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    ensure_tables(conn)
    print(f"[INFO] 数据库: {DB_PATH}")

    # ── 逐个基金处理 ──
    total_info = 0
    total_nav = 0
    total_market = 0
    success_count = 0
    fail_count = 0
    start_time = time.time()

    for idx, code in enumerate(fund_codes, 1):
        print(f"\n[{idx}/{len(fund_codes)}] ", end="")
        try:
            info_rows, nav_rows, market_rows = process_one_fund(conn, code, args.since)
            total_info += info_rows
            total_nav += nav_rows
            total_market += market_rows
            if info_rows > 0 or nav_rows > 0 or market_rows > 0:
                success_count += 1
            else:
                fail_count += 1
            # 避免请求过快触发风控
            if idx < len(fund_codes):
                time.sleep(0.5)
        except KeyboardInterrupt:
            print("\n[INFO] 用户中断")
            break
        except Exception as e:
            print(f"  [ERROR] 处理基金 {code} 时发生未预期异常: {e}")
            fail_count += 1

    # ── 统计 ──
    elapsed = time.time() - start_time
    conn.close()

    print(f"\n{'='*50}")
    print(f"  采集完成!")
    print(f"  ⏱  耗时: {elapsed:.1f} 秒")
    print(f"  📊 处理基金: {success_count + fail_count} 只")
    print(f"     ✅ 成功: {success_count} 只")
    print(f"     ❌ 失败: {fail_count} 只")
    print(f"  📝 写入 fund_info: {total_info} 条")
    print(f"  📝 写入 fund_nav: {total_nav} 条")
    print(f"  📝 写入 fund_market: {total_market} 条")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()