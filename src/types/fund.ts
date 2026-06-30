/** 基金基本信息 */
export interface FundInfo {
  fund_code: string
  fund_name: string
  fund_type: string | null
  is_traded: number
}

/** 基金净值记录 */
export interface FundNav {
  id?: number
  fund_code: string
  nav_date: string
  unit_nav: number
  accum_nav: number | null
  daily_growth_rate: number | null
}

/** ETF/LOF 日K行情数据 */
export interface FundMarket {
  id?: number
  fund_code: string
  trade_date: string
  open: number
  high: number
  low: number
  close: number
  volume: number | null
  amount: number | null
  change_pct: number | null
}

/** 行情列表每行展示的聚合数据 */
export interface FundDisplay {
  info: FundInfo
  latestNav: FundNav | null
}

/** 搜索结果单条（含最新净值） */
export interface SearchResult {
  info: FundInfo
  latestNav: FundNav | null
}

/** 长按事件 payload */
export interface LongPressPayload {
  fundCode: string
  fundName: string
  x: number
  y: number
}