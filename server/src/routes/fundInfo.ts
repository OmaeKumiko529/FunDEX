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

// GET /api/fund-info/search — 按代码或名称搜索基金（模糊匹配）
// 返回基金基本信息 + 最新净值
// 注意：必须在 /:code 之前注册，否则会被 /:code 捕获
router.get('/search', (req: Request, res: Response) => {
  const { keyword } = req.query as Record<string, string | undefined>;
  if (!keyword || keyword.trim().length === 0) {
    res.json({ data: [] });
    return;
  }

  const db = getDB();
  const like = `%${keyword.trim()}%`;

  // 一次查询：基金信息 LEFT JOIN 最新净值
  const sql = `
    SELECT fi.*, fn.unit_nav, fn.nav_date, fn.daily_growth_rate
    FROM fund_info fi
    LEFT JOIN (
      SELECT n1.fund_code, n1.unit_nav, n1.nav_date, n1.daily_growth_rate
      FROM fund_nav n1
      INNER JOIN (
        SELECT fund_code, MAX(nav_date) AS max_date
        FROM fund_nav
        GROUP BY fund_code
      ) n2 ON n1.fund_code = n2.fund_code AND n1.nav_date = n2.max_date
    ) fn ON fi.fund_code = fn.fund_code
    WHERE fi.fund_code LIKE ? OR fi.fund_name LIKE ?
    ORDER BY fi.fund_code
    LIMIT 30
  `;
  const rows = db.all<Record<string, unknown>>(sql, like, like);

  const data = rows.map(r => ({
    info: {
      fund_code: r.fund_code,
      fund_name: r.fund_name,
      fund_type: r.fund_type ?? null,
      is_traded: r.is_traded ?? 0,
    },
    latestNav: r.unit_nav != null ? {
      fund_code: r.fund_code,
      nav_date: r.nav_date ?? null,
      unit_nav: r.unit_nav,
      daily_growth_rate: r.daily_growth_rate ?? null,
    } : null,
  }));

  res.json({ data });
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