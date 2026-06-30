import express from 'express';
import cors from 'cors';
import { initDatabase } from './schema.js';
import fundInfoRouter from './routes/fundInfo.js';
import fundNavRouter from './routes/fundNav.js';
import fundMarketRouter from './routes/fundMarket.js';
import fundFetchRouter from './routes/fundFetch.js';

// ──────────────────────────────────────────────
//  Express 服务入口
// ──────────────────────────────────────────────

// 启动时初始化数据库表
initDatabase();

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

// 中间件
app.use(cors());
app.use(express.json());

// 路由
app.use('/api/fund-info', fundInfoRouter);
app.use('/api/fund-nav', fundNavRouter);
app.use('/api/fund-market', fundMarketRouter);
app.use('/api/fund-fetch', fundFetchRouter);

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 启动
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] FundEx 服务已启动 → http://0.0.0.0:${PORT}`);
  console.log(`[server] 局域网访问 → http://192.168.31.250:${PORT}`);
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
  console.log(`  GET  /api/health`);
});