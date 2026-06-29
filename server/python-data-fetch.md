# FundEx Python 数据采集模块

## 文件结构

```
server/
├── fetch_fund_data.py      # 数据采集脚本（核心）
├── fund_list.txt           # 基金代码列表配置
├── data/
│   └── fundex.db           # SQLite 数据库（与 Node 后端共享）
```

---


## 数据库表结构

### fund_info — 基金信息表

| 字段 | 类型 | 约束 | 说明 | AkShare 数据来源 |
|------|------|------|------|----------------|
| `fund_code` | TEXT | PRIMARY KEY | 基金代码 | `fund_name_em()` → `基金代码` |
| `fund_name` | TEXT | NOT NULL | 基金名称 | `fund_name_em()` → `基金简称` |
| `fund_type` | TEXT | — | 基金类型（如 `混合型-灵活`） | `fund_name_em()` → `基金类型` |

**DDL:**
```sql
CREATE TABLE IF NOT EXISTS fund_info (
    fund_code TEXT PRIMARY KEY,
    fund_name TEXT NOT NULL,
    fund_type TEXT
);
```

### fund_nav — 基金净值表

| 字段 | 类型 | 约束 | 说明 | AkShare 数据来源 |
|------|------|------|------|----------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 自增主键 | — |
| `fund_code` | TEXT | NOT NULL, FOREIGN KEY | 基金代码 | — |
| `nav_date` | TEXT | NOT NULL | 净值日期 (YYYY-MM-DD) | `单位净值走势` → `净值日期` |
| `unit_nav` | REAL | NOT NULL | 单位净值 | `单位净值走势` → `单位净值` |
| `accum_nav` | REAL | — | 累计净值 | `累计净值走势` → `累计净值` |
| `daily_growth_rate` | REAL | — | 日增长率（小数，如 `0.0361` 表示 3.61%） | `单位净值走势` → `日增长率`（原始为百分比值，脚本自动 ÷100） |

**DDL:**
```sql
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

CREATE INDEX IF NOT EXISTS idx_fund_nav_code_date ON fund_nav(fund_code, nav_date);
```

---

## 数据样例

### fund_info

| fund_code | fund_name | fund_type |
|-----------|-----------|-----------|
| 000001 | 华夏成长混合 | 混合型-灵活 |
| 110011 | 易方达优质精选混合(QDII) | QDII-混合偏股 |
| 161725 | 招商中证白酒指数(LOF)A | 指数型-股票 |

### fund_nav（000001 最新 5 条）

| fund_code | nav_date | unit_nav | accum_nav | daily_growth_rate |
|-----------|----------|----------|-----------|-------------------|
| 000001 | 2026-06-29 | 1.578 | — | 0.0361 |
| 000001 | 2026-06-26 | 1.523 | — | -0.0098 |
| 000001 | 2026-06-25 | 1.538 | — | 0.0253 |
| 000001 | 2026-06-24 | 1.500 | — | 0.0345 |
| 000001 | 2026-06-23 | 1.450 | — | -0.0129 |

> 日增长率说明：AkShare 原始返回 `3.61`（百分比值），脚本自动转换为小数 `0.0361`，前端使用时可直接参与计算。

---

## 脚本使用

### 安装

```bash
pip install akshare --upgrade -i https://pypi.tuna.tsinghua.edu.cn/simple
```

### 运行

```bash
cd server

# 从 fund_list.txt 读取基金列表（全量拉取所有历史）
python fetch_fund_data.py

# 指定基金代码
python fetch_fund_data.py 000001 110011 161725

# 增量拉取（只拉取指定日期之后的数据）
python fetch_fund_data.py --since 2026-06-01

# 组合使用
python fetch_fund_data.py 000001 --since 2026-06-01
```

### fund_list.txt 配置

```txt
# 基金代码列表（每行一个，空行和 # 开头的行被忽略）
# 格式: fund_code [备注]
000001    # 华夏成长混合
110011    # 易方达中小盘混合
161725    # 招商中证白酒指数
```

### Windows 定时任务

```bash
# 每天 18:00 自动拉取最新数据
schtasks /create /tn "FundexFetch" /tr "python F:\Projects\fundex\server\fetch_fund_data.py" /sc daily /st 18:00
```

---

## 关键设计

| 特性 | 说明 |
|------|------|
| **幂等写入** | `INSERT OR REPLACE` + `UNIQUE(fund_code, nav_date)`，重复运行不会产生重复数据 |
| **并发安全** | WAL 模式，Python 写库的同时 Node 后端可正常读取 |
| **容错** | 单只基金拉取失败不影响其他基金 |
| **请求间隔** | 每只基金间隔 0.5 秒，避免触发东方财富风控 |
| **日增长率转换** | 百分比值 → 小数，统一数据格式 |