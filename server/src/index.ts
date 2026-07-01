import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDatabase } from './schema.js';
import fundInfoRouter from './routes/fundInfo.js';
import fundNavRouter from './routes/fundNav.js';
import fundMarketRouter from './routes/fundMarket.js';
import fundFetchRouter from './routes/fundFetch.js';
import stockFetchRouter from './routes/stockFetch.js';
import stockMarketRouter from './routes/stockMarket.js';
import authRouter from './routes/auth.js';

// ──────────────────────────────────────────────
//  Express 服务入口
// ──────────────────────────────────────────────

// 启动时初始化数据库表
initDatabase();

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

// 中间件
app.use(cors());

// 确保 JSON 请求体被正确解析（Express 5 需要明确指定内容类型）
app.use(express.json({
  type: ['application/json', 'text/plain'],
  limit: '1mb',
}));
// URL 编码解析（某些 Android WebView fetch 环境需要）
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 静态文件服务：头像目录
const AVATAR_DIR = path.resolve(import.meta.dirname, 'data/avatars');
app.use('/avatars', express.static(AVATAR_DIR));

// 路由
app.use('/api/fund-info', fundInfoRouter);
app.use('/api/fund-nav', fundNavRouter);
app.use('/api/fund-market', fundMarketRouter);
app.use('/api/fund-fetch', fundFetchRouter);
app.use('/api/stock-fetch', stockFetchRouter);
app.use('/api/stock', stockMarketRouter);
app.use('/api/auth', authRouter);

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 启动
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] FundEx 服务已启动 → http://0.0.0.0:${PORT}`);
  console.log(`[server] 局域网访问 → http://localhost:${PORT}`);
  console.log(`[server] API 端点:`);
  console.log(`  GET  /api/fund-info`);
  console.log(`  GET  /api/fund-info/:code`);
  console.log(`  POST /api/fund-info`);
  console.log(`  GET  /api/fund-nav/:code`);
  console.log(`  GET  /api/fund-nav/:code/latest`);
  console.log(`  POST /api/fund-nav`);
  console.log(`  GET  /api/fund-market/:code`);
  console.log(`  POST /api/fund-market`);
  console.log(`  POST /api/fund-fetch`);
  console.log(`  POST /api/stock-fetch`);
  console.log(`  GET  /api/stock/list`);
  console.log(`  GET  /api/stock/:code`);
  console.log(`  GET  /api/stock/:code/history`);
  console.log(`  GET  /api/stock/market/snapshot`);
  console.log(`  GET  /api/health`);
  console.log(`  POST /api/auth/register`);
  console.log(`  POST /api/auth/login`);
  console.log(`  GET  /api/auth/me`);
  console.log(`  PUT  /api/auth/profile`);
  console.log(`  POST /api/auth/avatar`);
  console.log(`  POST /api/auth/logout`);
});
