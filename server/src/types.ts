/** 基金信息 */
export interface FundInfo {
  fund_code: string;
  fund_name: string;
  fund_type: string | null;
  is_traded: number;
}

/** 基金净值 */
export interface FundNav {
  id?: number;
  fund_code: string;
  nav_date: string;
  unit_nav: number;
  accum_nav: number | null;
  daily_growth_rate: number | null;
}

/** ETF/LOF 行情数据（日K） */
export interface FundMarket {
  id?: number;
  fund_code: string;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  amount: number | null;
  change_pct: number | null;
}

// ──────────────────────────────────────────────
//  股票相关类型
// ──────────────────────────────────────────────

/** 股票基本信息 */
export interface StockInfo {
  stock_code: string;
  stock_name: string;
  market: string | null;   // sh / sz / bj
  industry: string | null;
  list_date: string | null;
  is_active: number;       // 1=正常交易, 0=停牌/退市
}

/** 股票日K行情 */
export interface StockDaily {
  id?: number;
  stock_code: string;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  amount: number | null;
  change_pct: number | null;
  turnover_rate: number | null;
}

/** 股票实时快照（来自东方财富实时行情） */
export interface StockSnapshot {
  stock_code: string;
  stock_name: string;
  price: number;            // 最新价
  change: number;           // 涨跌额
  change_pct: number;       // 涨跌幅
  volume: number;           // 成交量（手）
  amount: number;           // 成交额
  open: number;             // 今开
  high: number;             // 最高
  low: number;              // 最低
  prev_close: number;       // 昨收
  turnover_rate: number | null;  // 换手率
  pe: number | null;        // 市盈率
  market_cap: number | null;     // 总市值
}

// ──────────────────────────────────────────────
//  用户 & 认证相关类型
// ──────────────────────────────────────────────

/** 用户 */
export interface User {
  id: number;
  email: string;
  password_hash: string;
  display_name: string | null;
  bio: string | null;
  avatar_path: string | null;
  created_at: string;
  updated_at: string;
}

/** 用户公开信息（不含密码） */
export interface UserPublic {
  id: number;
  email: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

/** 会话 */
export interface Session {
  id: number;
  user_id: number;
  token: string;
  created_at: string;
  expires_at: string;
}

/** 登录请求体 */
export interface LoginRequest {
  email: string;
  password: string;
}

/** 注册请求体 */
export interface RegisterRequest {
  email: string;
  password: string;
  display_name?: string;
}

/** 更新个人资料请求体 */
export interface UpdateProfileRequest {
  display_name?: string;
  bio?: string;
}

/** 登录/注册响应 */
export interface AuthResponse {
  user: UserPublic;
  token: string;
}
