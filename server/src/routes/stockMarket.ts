import { Router, Request, Response } from 'express';
import { getDB } from '../sql.js';
import type { StockInfo, StockDaily, StockSnapshot } from '../types.js';

const router = Router();

/**
 * GET /api/stock/list — 获取所有已缓存的股票列表
 */
router.get('/list', (_req: Request, res: Response) => {
  const db = getDB();
  const rows = db.all<StockInfo>(
    'SELECT * FROM stock_info WHERE is_active = 1 ORDER BY stock_code'
  );
  res.json({ data: rows });
});

/**
 * GET /api/stock/:code — 获取单只股票基本信息
 */
router.get('/:code', (req: Request, res: Response) => {
  const db = getDB();
  const code = req.params.code as string;

  if (!/^\d{6}$/.test(code)) {
    res.status(400).json({ error: '无效的股票代码，应为6位数字' });
    return;
  }

  const row = db.get<StockInfo>(
    'SELECT * FROM stock_info WHERE stock_code = ?',
    code
  );

  if (!row) {
    res.status(404).json({ error: `股票 ${code} 未找到` });
    return;
  }

  res.json({ data: row });
});

/**
 * GET /api/stock/:code/history — 获取历史日K
 * Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD 日期筛选
 * Query: ?limit=120 限制返回条数（默认最近120条）
 */
router.get('/:code/history', (req: Request, res: Response) => {
  const db = getDB();
  const code = req.params.code as string;
  const { from, to, limit } = req.query as Record<string, string | undefined>;

  if (!/^\d{6}$/.test(code)) {
    res.status(400).json({ error: '无效的股票代码，应为6位数字' });
    return;
  }

  let sql = 'SELECT * FROM stock_daily WHERE stock_code = ?';
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

  if (limit) {
    sql += ' LIMIT ?';
    params.push(Number(limit));
  } else {
    sql += ' LIMIT 120';
    params.push(120);
  }

  const rows = db.all<StockDaily>(sql, ...params);
  res.json({ data: rows });
});

/**
 * GET /api/stock/market/snapshot — 获取实时行情快照
 * Query: ?codes=600519,000858 指定股票代码（逗号分隔）
 * 如果不传 codes，返回所有已缓存股票的实时快照
 */
router.get('/market/snapshot', (req: Request, res: Response) => {
  const db = getDB();
  const { codes } = req.query as Record<string, string | undefined>;

  // 获取所有活跃股票代码
  let stockCodes: string[];
  if (codes) {
    stockCodes = codes.split(',').map(c => c.trim()).filter(c => /^\d{6}$/.test(c));
    if (stockCodes.length === 0) {
      res.status(400).json({ error: '无效的股票代码列表' });
      return;
    }
  } else {
    // 从 DB 中获取所有已缓存且活跃的股票代码
    const stocks = db.all<StockInfo>(
      'SELECT stock_code FROM stock_info WHERE is_active = 1'
    );
    stockCodes = stocks.map(s => s.stock_code);
  }

  // 注意：实时快照需要调用 Python 获取
  // 这里返回已缓存的最近日K收盘价作为替代
  // 客户端应在需要时调用 POST /api/stock-fetch?snapshot=true 获取最新快照
  const snapshots: StockSnapshot[] = [];

  for (const code of stockCodes) {
    const latest = db.get<StockDaily>(
      'SELECT * FROM stock_daily WHERE stock_code = ? ORDER BY trade_date DESC LIMIT 1',
      code
    );
    const info = db.get<StockInfo>(
      'SELECT * FROM stock_info WHERE stock_code = ?',
      code
    );

    if (latest && info) {
      snapshots.push({
        stock_code: code,
        stock_name: info.stock_name,
        price: latest.close,
        change: 0,        // 实时数据需 Python 快照
        change_pct: latest.change_pct ?? 0,
        volume: latest.volume ?? 0,
        amount: latest.amount ?? 0,
        open: latest.open,
        high: latest.high,
        low: latest.low,
        prev_close: 0,   // 实时数据需 Python 快照
        turnover_rate: latest.turnover_rate,
        pe: null,        // 实时数据需 Python 快照
        market_cap: null, // 实时数据需 Python 快照
      });
    }
  }

  res.json({
    data: snapshots,
    meta: {
      note: '此为缓存数据，如需实时快照请调用 POST /api/stock-fetch?snapshot=true',
    },
  });
});

export default router;