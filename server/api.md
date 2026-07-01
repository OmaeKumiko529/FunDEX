# FundEx 服务端 API 文档

## 基本信息

- **基础地址**: `http://localhost:3000`
- **Content-Type**: `application/json`
- **数据库**: SQLite（`server/data/fundex.db`）
- **WAL 模式**: 支持 Node / Python 同时读写

---

## 数据库表结构

### fund_info — 基金信息表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `fund_code` | TEXT | **PRIMARY KEY** | 基金代码，如 `"000001"` |
| `fund_name` | TEXT | NOT NULL | 基金名字 |
| `fund_type` | TEXT | — | 基金类型：混合型 / 股票型 / 债券型 等 |
| `is_traded` | INTEGER | DEFAULT 0 | 是否为场内可交易品种（1=ETF/LOF） |

### fund_nav — 基金净值表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 自增主键 |
| `fund_code` | TEXT | NOT NULL, FOREIGN KEY | 基金代码，关联 `fund_info` |
| `nav_date` | TEXT | NOT NULL | 净值日期，ISO 8601 格式 |
| `unit_nav` | REAL | NOT NULL | 单位净值 |
| `accum_nav` | REAL | — | 累计净值 |
| `daily_growth_rate` | REAL | — | 日增长率（小数，如 `0.0123` 表示 1.23%） |
| | | **UNIQUE (fund_code, nav_date)** | 防止同一日期同一基金重复录入 |

### fund_market — ETF/LOF 日K行情表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 自增主键 |
| `fund_code` | TEXT | NOT NULL, FOREIGN KEY | 基金代码，关联 `fund_info` |
| `trade_date` | TEXT | NOT NULL | 交易日期 |
| `open` / `high` / `low` / `close` | REAL | — | OHLC 价格 |
| `volume` / `amount` | REAL | — | 成交量/成交额 |
| `change_pct` | REAL | — | 涨跌幅（小数） |
| | | **UNIQUE (fund_code, trade_date)** | |

### stock_info — 股票信息表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `stock_code` | TEXT | **PRIMARY KEY** | 股票代码，如 `"600519"` |
| `stock_name` | TEXT | NOT NULL | 股票名称 |
| `market` | TEXT | — | 交易所: sh / sz / bj |
| `industry` | TEXT | — | 所属行业 |
| `list_date` | TEXT | — | 上市日期 |
| `is_active` | INTEGER | DEFAULT 1 | 是否正常交易 |

### stock_daily — 股票日K行情表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 自增主键 |
| `stock_code` | TEXT | NOT NULL, FOREIGN KEY | 股票代码，关联 `stock_info` |
| `trade_date` | TEXT | NOT NULL | 交易日期 |
| `open` / `high` / `low` / `close` | REAL | — | OHLC 价格（前复权） |
| `volume` / `amount` | REAL | — | 成交量（股）/ 成交额（元） |
| `change_pct` | REAL | — | 涨跌幅（小数） |
| `turnover_rate` | REAL | — | 换手率（%） |
| | | **UNIQUE (stock_code, trade_date)** | |

---

## API 端点

### 0. 健康检查

```
GET /api/health
```

**响应**:
```json
{ "status": "ok", "timestamp": "2024-01-13T12:00:00.000Z" }
```

---

### 1. 基金 API

#### 1.1 GET /api/fund-info — 获取所有基金列表

```json
{ "data": [{ "fund_code": "000001", "fund_name": "华夏成长混合", "fund_type": "混合型", "is_traded": 0 }, ...] }
```

#### 1.2 GET /api/fund-info/:code — 获取单只基金信息

```json
{ "data": { "fund_code": "000001", "fund_name": "华夏成长混合", ... } }
```

#### 1.3 POST /api/fund-info — 批量写入基金信息（幂等）

```json
// 请求体: FundInfo 数组
[{ "fund_code": "000001", "fund_name": "华夏成长混合", "fund_type": "混合型" }]

// 响应
{ "data": { "inserted": 1 } }
```

#### 1.4 GET /api/fund-nav/:code — 获取基金历史净值

Query: `?from=2024-01-01&to=2024-01-31`

```json
{ "data": [{ "fund_code": "000001", "nav_date": "2024-01-13", "unit_nav": 1.2345, "accum_nav": 3.4567, "daily_growth_rate": 0.5 }, ...] }
```

#### 1.5 GET /api/fund-nav/:code/latest — 获取基金最新净值

```json
{ "data": { "fund_code": "000001", "nav_date": "2024-01-13", "unit_nav": 1.2345, ... } }
```

#### 1.6 POST /api/fund-nav — 批量写入净值数据（幂等）

```json
{ "data": { "inserted": 2 } }
```

#### 1.7 GET /api/fund-market/:code — 获取 ETF/LOF 日K行情

Query: `?from=2024-01-01&to=2024-01-31`

```json
{ "data": [{ "fund_code": "161725", "trade_date": "2024-01-13", "open": 0.9876, "close": 0.9821, ... }, ...] }
```

#### 1.8 POST /api/fund-market — 批量写入日K行情（幂等）

#### 1.9 POST /api/fund-fetch — 触发基金数据采集（调用Python爬虫）

Body: `{ "fund_code": "000001" }` 或 `{}`（批量）

---

### 2. 股票行情 API

#### 2.1 POST /api/stock-fetch — 触发股票数据采集

**Body:**
```json
{ "stock_code": "600519" }   // 指定单只股票
{ }                           // 从 stock_list.txt 批量抓取
```

**Query:**
- `?snapshot=true` — 仅获取实时快照（不写入DB）
- `?since=2025-01-01` — 仅拉取该日期后的数据

**响应:**
```json
{ "data": { "success": true, "stock_code": "600519", "message": "数据已获取并写入数据库", "output": "..." } }
```

#### 2.2 GET /api/stock/list — 获取所有已缓存的股票列表

```json
{ "data": [{ "stock_code": "600519", "stock_name": "贵州茅台", "market": "sh", "industry": "白酒", "list_date": "2001-08-27", "is_active": 1 }, ...] }
```

#### 2.3 GET /api/stock/:code — 获取单只股票基本信息

```json
{ "data": { "stock_code": "600519", "stock_name": "贵州茅台", ... } }
```

#### 2.4 GET /api/stock/:code/history — 获取历史日K

**Query:** `?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=120`

```json
{ "data": [{ "stock_code": "600519", "trade_date": "2026-06-29", "open": 1495.0, "high": 1510.0, "low": 1488.0, "close": 1505.0, "volume": 5000000, "amount": 7500000000, "change_pct": 0.0055, "turnover_rate": 0.25 }, ...] }
```

#### 2.5 GET /api/stock/market/snapshot — 获取实时行情快照

**Query:** `?codes=600519,000858`（逗号分隔，可选）

```json
{ "data": [{ "stock_code": "600519", "stock_name": "贵州茅台", "price": 1505.0, "change_pct": 0.0055, ... }], "meta": { "note": "此为缓存数据，如需实时快照请调用 POST /api/stock-fetch?snapshot=true" } }
```

---

## 本地启动

```bash
cd server

# 安装依赖（首次）
npm install

# 测试数据注入 + 读写验证
npx tsx src/seed.ts

# 启动 HTTP 服务（开发模式，自动监听文件变化）
npx tsx watch src/index.ts

# 启动 HTTP 服务（生产模式）
npx tsx src/index.ts
```

## 数据采集（Python）

```bash
cd server

# 批量获取基金数据（从 fund_list.txt）
python fetch_fund_data.py

# 获取单个基金
python fetch_fund_data.py 000001

# 增量更新（仅获取指定日期后）
python fetch_fund_data.py --since 2025-01-01

# 批量获取股票数据（从 stock_list.txt）
python fetch_stock_data.py

# 获取单只股票日K
python fetch_stock_data.py 600519

# 实时快照（不写入DB）
python fetch_stock_data.py 600519 000858 --snapshot