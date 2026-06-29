import { getDB } from './sql.js';

// ──────────────────────────────────────────────
//  数据库建表 / 初始化
// ──────────────────────────────────────────────

const CREATE_TABLES = `
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
`;

/** 初始化数据库：建表（幂等，多次调用安全） */
export function initDatabase(): void {
  const db = getDB();
  db.exec(CREATE_TABLES);
  // 兼容已有数据库：添加 is_traded 列（如果不存在）
  try {
    db.exec("ALTER TABLE fund_info ADD COLUMN is_traded INTEGER DEFAULT 0");
  } catch {
    // 列已存在，忽略
  }
  console.log('[schema] 数据库表初始化完成');
}