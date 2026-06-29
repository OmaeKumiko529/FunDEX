import { Router, Request, Response } from 'express';
import { getDB } from '../sql.js';
import type { FundInfo } from '../types.js';

const router = Router();

// GET /api/fund-info — 获取所有基金列表
router.get('/', (_req: Request, res: Response) => {
  const db = getDB();
  const rows = db.all<FundInfo>('SELECT * FROM fund_info ORDER BY fund_code');
  res.json({ data: rows });
});

// GET /api/fund-info/:code — 获取单只基金信息
router.get('/:code', (req: Request, res: Response) => {
  const db = getDB();
  const row = db.get<FundInfo>('SELECT * FROM fund_info WHERE fund_code = ?', req.params.code);
  if (!row) {
    res.status(404).json({ error: '基金不存在' });
    return;
  }
  res.json({ data: row });
});

// POST /api/fund-info — 批量写入基金信息（幂等：INSERT OR REPLACE）
router.post('/', (req: Request, res: Response) => {
  const rows = req.body as FundInfo[];
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: '请求体应为非空数组' });
    return;
  }

  const db = getDB();
  const sql = 'INSERT OR REPLACE INTO fund_info (fund_code, fund_name, fund_type, is_traded) VALUES (?, ?, ?, ?)';
  const params = rows.map(r => [r.fund_code, r.fund_name, r.fund_type ?? null, r.is_traded ?? 0]);
  const result = db.insertBatch(sql, params);

  res.json({ data: { inserted: result.changes } });
});

export default router;