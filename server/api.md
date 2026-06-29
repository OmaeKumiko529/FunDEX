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


### fund_info — 基金信息表（DDL）

```sql
CREATE TABLE IF NOT EXISTS fund_info (
    fund_code TEXT PRIMARY KEY,
    fund_name TEXT NOT NULL,
    fund_type TEXT
);
```

### fund_nav — 基金净值表（DDL）

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

## API 端点

### 1. 健康检查

```
GET /api/health
```

**响应示例**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-13T12:00:00.000Z"
}
```

---

### 2. 获取所有基金列表

```
GET /api/fund-info
```

**响应示例**:
```json
{
  "data": [
    {
      "fund_code": "000001",
      "fund_name": "华夏成长混合",
      "fund_type": "混合型"
    },
    {
      "fund_code": "110011",
      "fund_name": "易方达中小盘混合",
      "fund_type": "混合型"
    }
  ]
}
```

---

### 3. 获取单只基金信息

```
GET /api/fund-info/:code
```

**参数**:

| 参数 | 位置 | 说明 |
|------|------|------|
| `code` | URL 路径 | 基金代码，如 `000001` |

**响应示例**:
```json
{
  "data": {
    "fund_code": "000001",
    "fund_name": "华夏成长混合",
    "fund_type": "混合型"
  }
}
```

**错误响应** (404):
```json
{
  "error": "基金不存在"
}
```

---

### 4. 批量写入基金信息

```
POST /api/fund-info
```

**请求体**: 基金信息数组

```json
[
  {
    "fund_code": "000001",
    "fund_name": "华夏成长混合",
    "fund_type": "混合型"
  },
  {
    "fund_code": "110011",
    "fund_name": "易方达中小盘混合",
    "fund_type": "混合型"
  }
]
```

> **幂等说明**: 使用 `INSERT OR REPLACE`，同 `fund_code` 重复写入会覆盖，不会产生重复行。

**响应示例**:
```json
{
  "data": {
    "inserted": 2
  }
}
```

---

### 5. 获取基金历史净值

```
GET /api/fund-nav/:code
```

**参数**:

| 参数 | 位置 | 类型 | 说明 |
|------|------|------|------|
| `code` | URL 路径 | string | 基金代码，如 `000001` |
| `from` | Query | string | 起始日期，可选，格式 `YYYY-MM-DD` |
| `to` | Query | string | 截止日期，可选，格式 `YYYY-MM-DD` |

**请求示例**:
```
GET /api/fund-nav/000001?from=2024-01-01&to=2024-01-31
```

**响应示例**:
```json
{
  "data": [
    {
      "id": 1,
      "fund_code": "000001",
      "nav_date": "2024-01-13",
      "unit_nav": 1.2345,
      "accum_nav": 3.4567,
      "daily_growth_rate": 0.5
    },
    {
      "id": 2,
      "fund_code": "000001",
      "nav_date": "2024-01-12",
      "unit_nav": 1.2289,
      "accum_nav": 3.4412,
      "daily_growth_rate": -0.32
    }
  ]
}
```

> 结果按 `nav_date DESC`（日期降序）排列。

---

### 6. 获取基金最新净值

```
GET /api/fund-nav/:code/latest
```

**参数**:

| 参数 | 位置 | 说明 |
|------|------|------|
| `code` | URL 路径 | 基金代码，如 `000001` |

**响应示例**:
```json
{
  "data": {
    "id": 1,
    "fund_code": "000001",
    "nav_date": "2024-01-13",
    "unit_nav": 1.2345,
    "accum_nav": 3.4567,
    "daily_growth_rate": 0.5
  }
}
```

**错误响应** (404):
```json
{
  "error": "未找到净值数据"
}
```

---

### 7. 批量写入净值数据

```
POST /api/fund-nav
```

**请求体**: 净值数据数组

```json
[
  {
    "fund_code": "000001",
    "nav_date": "2024-01-14",
    "unit_nav": 1.2400,
    "accum_nav": 3.4700,
    "daily_growth_rate": 0.5
  },
  {
    "fund_code": "000001",
    "nav_date": "2024-01-13",
    "unit_nav": 1.2345,
    "accum_nav": 3.4567,
    "daily_growth_rate": -0.32
  }
]
```

> **幂等说明**: 使用 `INSERT OR REPLACE` + 表级 `UNIQUE(fund_code, nav_date)` 约束。
> 同 `fund_code + nav_date` 重复写入会覆盖，不会产生重复行。

**响应示例**:
```json
{
  "data": {
    "inserted": 2
  }
}
```

---

## Python 模块接入示例

Python 直接通过 `sqlite3` 连接同一个 `.db` 文件，与 Node 服务共享数据库：

```python
import sqlite3

conn = sqlite3.connect('server/data/fundex.db')

# 写入基金信息
conn.execute(
    "INSERT OR REPLACE INTO fund_info (fund_code, fund_name, fund_type) VALUES (?, ?, ?)",
    ('000001', '华夏成长混合', '混合型')
)

# 写入净值数据（幂等，重复跑不会产生脏数据）
conn.execute(
    "INSERT OR REPLACE INTO fund_nav (fund_code, nav_date, unit_nav, accum_nav, daily_growth_rate) VALUES (?, ?, ?, ?, ?)",
    ('000001', '2024-01-14', 1.2400, 3.4700, 0.5)
)

conn.commit()
conn.close()
```

> WAL 模式下 Node 和 Python 可同时读写同一数据库文件，不会出现 `SQLITE_BUSY` 错误。

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