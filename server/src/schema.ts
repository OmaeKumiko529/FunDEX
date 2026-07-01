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

-- 股票基本信息表
CREATE TABLE IF NOT EXISTS stock_info (
    stock_code TEXT PRIMARY KEY,
    stock_name TEXT NOT NULL,
    market TEXT,
    industry TEXT,
    list_date TEXT,
    is_active INTEGER DEFAULT 1
);

-- 股票日K行情表
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

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    bio TEXT,
    avatar_path TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
);

-- 会话（登录态）表
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_fund_nav_code_date ON fund_nav(fund_code, nav_date);
CREATE INDEX IF NOT EXISTS idx_fund_market_code_date ON fund_market(fund_code, trade_date);
CREATE INDEX IF NOT EXISTS idx_stock_daily_code_date ON stock_daily(stock_code, trade_date);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
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