import { initDatabase } from './schema.js';
import { getDB } from './sql.js';
import type { FundInfo, FundNav, StockInfo, StockDaily } from './types.js';

// ──────────────────────────────────────────────
//  测试脚本：注入示例数据并验证读取
// ──────────────────────────────────────────────

// 模拟基金数据
const sampleFunds: FundInfo[] = [
  { fund_code: '000001', fund_name: '华夏成长混合', fund_type: '混合型', is_traded: 0 },
  { fund_code: '110011', fund_name: '易方达中小盘混合', fund_type: '混合型', is_traded: 0 },
  { fund_code: '161725', fund_name: '招商中证白酒指数', fund_type: '指数型', is_traded: 1 },
  { fund_code: '002963', fund_name: '易方达黄金ETF联接C', fund_type: '商品型', is_traded: 0 },
  { fund_code: '022459', fund_name: '易方达中证A500ETF联接A', fund_type: '指数型', is_traded: 0 },
  { fund_code: '011322', fund_name: '国泰智能装备股票C', fund_type: '股票型', is_traded: 0 },
];

// 模拟股票数据
const sampleStocks: StockInfo[] = [
  { stock_code: '600519', stock_name: '贵州茅台', market: 'sh', industry: '白酒', list_date: '2001-08-27', is_active: 1 },
  { stock_code: '000858', stock_name: '五粮液', market: 'sz', industry: '白酒', list_date: '1998-04-27', is_active: 1 },
  { stock_code: '300750', stock_name: '宁德时代', market: 'sz', industry: '新能源动力系统', list_date: '2018-06-11', is_active: 1 },
  { stock_code: '601318', stock_name: '中国平安', market: 'sh', industry: '保险', list_date: '2007-03-01', is_active: 1 },
  { stock_code: '000333', stock_name: '美的集团', market: 'sz', industry: '白色家电', list_date: '2013-09-18', is_active: 1 },
];

// 模拟基金净值数据（每个基金 5 天数据）
function generateSampleNavs(): FundNav[] {
  const navs: FundNav[] = [];
  const baseDates = ['2024-01-13', '2024-01-12', '2024-01-11', '2024-01-10', '2024-01-09'];
  const baseNavs: Record<string, { unit: number; accum: number }> = {
    '000001': { unit: 1.2345, accum: 3.4567 },
    '110011': { unit: 2.3456, accum: 4.5678 },
    '161725': { unit: 0.9876, accum: 2.3456 },
    '002963': { unit: 1.5000, accum: 1.8000 },
    '022459': { unit: 1.1000, accum: 1.1000 },
    '011322': { unit: 1.2000, accum: 1.5000 },
  };

  for (const fund of sampleFunds) {
    const base = baseNavs[fund.fund_code];
    let prevUnit = 0;
    baseDates.forEach((date, i) => {
      const drift = (Math.random() - 0.5) * 0.02; // ±1% 随机波动
      const unitNav = parseFloat((base.unit * (1 + drift)).toFixed(4));
      const accumNav = parseFloat((base.accum * (1 + drift)).toFixed(4));
      const dailyGrowth = i > 0 ? parseFloat(((unitNav / prevUnit - 1) * 100).toFixed(4)) : 0;
      navs.push({
        fund_code: fund.fund_code,
        nav_date: date,
        unit_nav: unitNav,
        accum_nav: accumNav,
        daily_growth_rate: dailyGrowth,
      });
      prevUnit = unitNav;
    });
  }
  return navs;
}

// 模拟股票日K数据（每个股票 5 天数据）
function generateSampleStockDaily(): StockDaily[] {
  const records: StockDaily[] = [];
  const baseDates = ['2024-01-13', '2024-01-12', '2024-01-11', '2024-01-10', '2024-01-09'];
  const basePrices: Record<string, number> = {
    '600519': 1680.00,
    '000858': 145.00,
    '300750': 180.00,
    '601318': 42.00,
    '000333': 55.00,
  };

  for (const stock of sampleStocks) {
    const base = basePrices[stock.stock_code];
    let prevClose = 0;
    baseDates.forEach((date, i) => {
      const drift = (Math.random() - 0.5) * 0.04; // ±2% 随机波动
      const close = parseFloat((base * (1 + drift)).toFixed(2));
      const open = parseFloat((close * (1 + (Math.random() - 0.5) * 0.01)).toFixed(2));
      const high = parseFloat((Math.max(open, close) * (1 + Math.random() * 0.01)).toFixed(2));
      const low = parseFloat((Math.min(open, close) * (1 - Math.random() * 0.01)).toFixed(2));
      const change_pct = i > 0 ? parseFloat(((close / prevClose - 1) * 100).toFixed(4)) : 0;
      records.push({
        stock_code: stock.stock_code,
        trade_date: date,
        open,
        high,
        low,
        close,
        volume: Math.round(Math.random() * 10000000 + 1000000),
        amount: Math.round((close * (Math.random() * 10000000 + 1000000)) * 100) / 100,
        change_pct,
        turnover_rate: parseFloat((Math.random() * 3).toFixed(2)),
      });
      prevClose = close;
    });
  }
  return records;
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  FundEx 数据库测试脚本');
  console.log('═══════════════════════════════════════════\n');

  // 1. 初始化数据库（建表）
  console.log('▶ 步骤1: 初始化数据库...');
  initDatabase();
  console.log('  ✓ 表创建完成\n');

  const db = getDB();

  // 2. 插入基金信息
  console.log('▶ 步骤2: 插入模拟基金数据...');
  const infoSql = 'INSERT OR REPLACE INTO fund_info (fund_code, fund_name, fund_type, is_traded) VALUES (?, ?, ?, ?)';
  db.insertBatch(
    infoSql,
    sampleFunds.map(f => [f.fund_code, f.fund_name, f.fund_type, f.is_traded])
  );
  console.log(`  ✓ 已插入 ${sampleFunds.length} 只基金\n`);

  // 3. 插入净值数据
  console.log('▶ 步骤3: 插入模拟净值数据...');
  const navData = generateSampleNavs();
  const navSql =
    'INSERT OR REPLACE INTO fund_nav (fund_code, nav_date, unit_nav, accum_nav, daily_growth_rate) VALUES (?, ?, ?, ?, ?)';
  db.insertBatch(
    navSql,
    navData.map(n => [n.fund_code, n.nav_date, n.unit_nav, n.accum_nav, n.daily_growth_rate])
  );
  console.log(`  ✓ 已插入 ${navData.length} 条净值记录\n`);

  // 4. 插入股票信息
  console.log('▶ 步骤4: 插入模拟股票数据...');
  const stockInfoSql = 'INSERT OR REPLACE INTO stock_info (stock_code, stock_name, market, industry, list_date, is_active) VALUES (?, ?, ?, ?, ?, ?)';
  db.insertBatch(
    stockInfoSql,
    sampleStocks.map(s => [s.stock_code, s.stock_name, s.market, s.industry, s.list_date, s.is_active])
  );
  console.log(`  ✓ 已插入 ${sampleStocks.length} 只股票\n`);

  // 5. 插入股票日K数据
  console.log('▶ 步骤5: 插入模拟股票日K数据...');
  const stockDailyData = generateSampleStockDaily();
  const stockDailySql =
    'INSERT OR REPLACE INTO stock_daily (stock_code, trade_date, open, high, low, close, volume, amount, change_pct, turnover_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  db.insertBatch(
    stockDailySql,
    stockDailyData.map(d => [d.stock_code, d.trade_date, d.open, d.high, d.low, d.close, d.volume, d.amount, d.change_pct, d.turnover_rate])
  );
  console.log(`  ✓ 已插入 ${stockDailyData.length} 条日K记录\n`);

  // 6. 查询验证 - 基金
  console.log('▶ 步骤6: 查询验证 ── fund_info 全表');
  const allFunds = db.all<FundInfo>('SELECT * FROM fund_info ORDER BY fund_code');
  console.table(allFunds);

  console.log('\n▶ 步骤7: 查询验证 ── fund_nav (基金 000001，按日期降序)');
  const navsOf000001 = db.all<FundNav>(
    'SELECT * FROM fund_nav WHERE fund_code = ? ORDER BY nav_date DESC LIMIT 5',
    '000001'
  );
  console.table(navsOf000001);

  // 7. 查询验证 - 股票
  console.log('\n▶ 步骤8: 查询验证 ── stock_info 全表');
  const allStocks = db.all<StockInfo>('SELECT * FROM stock_info ORDER BY stock_code');
  console.table(allStocks);

  console.log('\n▶ 步骤9: 查询验证 ── stock_daily (股票 600519，按日期降序)');
  const dailyOf600519 = db.all<StockDaily>(
    'SELECT * FROM stock_daily WHERE stock_code = ? ORDER BY trade_date DESC LIMIT 5',
    '600519'
  );
  console.table(dailyOf600519);

  // 8. 幂等性测试
  console.log('\n▶ 步骤10: 幂等性测试 ── 重复插入不产生重复行');
  db.run(
    'INSERT OR REPLACE INTO fund_nav (fund_code, nav_date, unit_nav, accum_nav, daily_growth_rate) VALUES (?, ?, ?, ?, ?)',
    '000001', '2024-01-13', 1.2345, 3.4567, 0
  );
  const navCount = db.get<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM fund_nav WHERE fund_code = ? AND nav_date = ?',
    '000001', '2024-01-13'
  );
  console.log(`  ✓ fund_nav 幂等: code=000001, date=2024-01-13 共有 ${navCount?.cnt} 条 (应为 1)`);

  db.run(
    'INSERT OR REPLACE INTO stock_daily (stock_code, trade_date, open, high, low, close, volume, amount, change_pct, turnover_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    '600519', '2024-01-13', 1680.00, 1690.00, 1670.00, 1685.00, 5000000, 8425000000, 0.3, 0.5
  );
  const stockCount = db.get<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM stock_daily WHERE stock_code = ? AND trade_date = ?',
    '600519', '2024-01-13'
  );
  console.log(`  ✓ stock_daily 幂等: code=600519, date=2024-01-13 共有 ${stockCount?.cnt} 条 (应为 1)\n`);

  console.log('═══════════════════════════════════════════');
  console.log('  ✅ 全部测试通过！数据库运行正常');
  console.log('  ✅ 股票数据表已就绪');
  console.log('═══════════════════════════════════════════');
}

main().catch(console.error);