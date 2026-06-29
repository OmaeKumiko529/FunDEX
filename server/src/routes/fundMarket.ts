import { Router, Request, Response } from 'express';
import { getDB } from '../sql.js';
import type { FundMarket } from '../types.js';

const router = Router();

// GET /api/fund-market/:code — 获取 ETF/LOF 日K数据
// 支持 ?from=YYYY-MM-DD&to=YYYY-MM-DD 日期筛选
router.get('/:code', (req: Request, res: Response) => {
  const db = getDB();
  const { code } = req.params;
  const { from, to } = req.query as Record<string, string | undefined>;

  let sql = 'SELECT * FROM fund_market WHERE fund_code = ?';
  const params: unknown[] = [code];

  if (from) {
    sql += ' AND trade_date >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND trade_date <= ?';
    params.push(to);
  }
  sql += ' ORDER BY trade_date DESC';

  const rows = db.all<FundMarket>(sql, ...params);
  res.json({ data: rows });
});

// POST /api/fund-market — 批量写入日K数据（幂等）
router.post('/', (req: Request, res: Response) => {
  const rows = req.body as FundMarket[];
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: '请求体应为非空数组' });
    return;
  }

  const db = getDB();
  const sql =
    'INSERT OR REPLACE INTO fund_market (fund_code, trade_date, open, high, low, close, volume, amount, change_pct) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
  const params = rows.map(r => [
    r.fund_code,
    r.trade_date,
    r.open ?? null,
    r.high ?? null,
    r.low ?? null,
    r.close ?? null,
    r.volume ?? null,
    r.amount ?? null,
    r.change_pct ?? null,
  ]);
  const result = db.insertBatch(sql, params);

  res.json({ data: { inserted: result.changes } });
});

export default router;