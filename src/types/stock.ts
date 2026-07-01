/** 股票基本信息 */
export interface StockInfo {
  stock_code: string;
  stock_name: string;
  market: string | null;
  industry: string | null;
  list_date: string | null;
  is_active: number;
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

/** 股票实时快照 */
export interface StockSnapshot {
  stock_code: string;
  stock_name: string;
  price: number;
  change: number;
  change_pct: number;
  volume: number;
  amount: number;
  open: number;
  high: number;
  low: number;
  prev_close: number;
  turnover_rate: number | null;
  pe: number | null;
  market_cap: number | null;
}

/** 股票列表查询返回 */
export interface StockListResponse {
  data: StockInfo[];
}

/** 股票日K历史返回 */
export interface StockHistoryResponse {
  data: StockDaily[];
}

/** 股票快照返回 */
export interface StockSnapshotResponse {
  data: StockSnapshot[];
  meta?: { note?: string };
}