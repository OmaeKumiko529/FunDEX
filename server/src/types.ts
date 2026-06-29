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