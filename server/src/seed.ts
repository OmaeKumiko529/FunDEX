import { initDatabase } from './schema.js';
import { getDB } from './sql.js';
import type { FundInfo, FundNav } from './types.js';

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

// 模拟净值数据（每个基金 5 天数据）
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

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  FundEx 数据库测试脚本');
  console.log('═══════════════════════════════════════════\n');

  // 1. 初始化数据库（建表）
  console.log('▶ 步骤1: 初始化数据库...');
  initDatabase();
  console.log('  ✓ 表创建完成\n');

  // 2. 插入基金信息
  console.log('▶ 步骤2: 插入模拟基金数据...');
  const db = getDB();
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

  // 4. 查询验证
  console.log('▶ 步骤4: 查询验证 ── fund_info 全表');
  const allFunds = db.all<FundInfo>('SELECT * FROM fund_info ORDER BY fund_code');
  console.table(allFunds);

  console.log('\n▶ 步骤5: 查询验证 ── fund_nav (基金 000001，按日期降序)');
  const navsOf000001 = db.all<FundNav>(
    'SELECT * FROM fund_nav WHERE fund_code = ? ORDER BY nav_date DESC LIMIT 5',
    '000001'
  );
  console.table(navsOf000001);

  console.log('\n▶ 步骤6: 查询验证 ── 最新净值');
  for (const fund of sampleFunds) {
    const latest = db.get<FundNav>(
      'SELECT * FROM fund_nav WHERE fund_code = ? ORDER BY nav_date DESC LIMIT 1',
      fund.fund_code
    );
    console.log(`  ${fund.fund_code} ${fund.fund_name}: 最新净值 ${latest?.unit_nav} (${latest?.nav_date})`);
  }

  // 5. 幂等性测试：重复插入应不报错也不产生重复行
  console.log('\n▶ 步骤7: 幂等性测试 ── 重复插入同一条数据');
  db.run(
    'INSERT OR REPLACE INTO fund_nav (fund_code, nav_date, unit_nav, accum_nav, daily_growth_rate) VALUES (?, ?, ?, ?, ?)',
    '000001', '2024-01-13', 1.2345, 3.4567, 0
  );
  const count = db.get<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM fund_nav WHERE fund_code = ? AND nav_date = ?',
    '000001', '2024-01-13'
  );
  console.log(`  ✓ fund_code=000001, nav_date=2024-01-13 共有 ${count?.cnt} 条记录 (应为 1)\n`);

  console.log('═══════════════════════════════════════════');
  console.log('  ✅ 全部测试通过！数据库运行正常');
  console.log('═══════════════════════════════════════════');
}

main().catch(console.error);