import { Router, Request, Response } from 'express';
import { getDB } from '../sql.js';
import type { FundNav } from '../types.js';

const router = Router();

// GET /api/fund-nav/:code — 获取某基金的历史净值
// 支持 ?from=2024-01-01&to=2024-12-31 日期筛选
router.get('/:code', (req: Request, res: Response) => {
  const db = getDB();
  const { code } = req.params;
  const { from, to } = req.query as Record<string, string | undefined>;

  let sql = 'SELECT * FROM fund_nav WHERE fund_code = ?';
  const params: unknown[] = [code];

  if (from) {
    sql += ' AND nav_date >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND nav_date <= ?';
    params.push(to);
  }
  sql += ' ORDER BY nav_date DESC';

  const rows = db.all<FundNav>(sql, ...params);
  res.json({ data: rows });
});

// GET /api/fund-nav/:code/latest — 获取某基金最新净值
router.get('/:code/latest', (req: Request, res: Response) => {
  const db = getDB();
  const row = db.get<FundNav>(
    'SELECT * FROM fund_nav WHERE fund_code = ? ORDER BY nav_date DESC LIMIT 1',
    req.params.code
  );
  if (!row) {
    res.status(404).json({ error: '未找到净值数据' });
    return;
  }
  res.json({ data: row });
});

// POST /api/fund-nav — 批量写入净值数据（幂等：INSERT OR REPLACE）
router.post('/', (req: Request, res: Response) => {
  const rows = req.body as FundNav[];
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: '请求体应为非空数组' });
    return;
  }

  const db = getDB();
  const sql =
    'INSERT OR REPLACE INTO fund_nav (fund_code, nav_date, unit_nav, accum_nav, daily_growth_rate) VALUES (?, ?, ?, ?, ?)';
  const params = rows.map(r => [
    r.fund_code,
    r.nav_date,
    r.unit_nav,
    r.accum_nav ?? null,
    r.daily_growth_rate ?? null,
  ]);
  const result = db.insertBatch(sql, params);

  res.json({ data: { inserted: result.changes } });
});

export default router;