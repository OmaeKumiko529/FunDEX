/**
 * FunDEX 数据采集快捷脚本
 * ========================
 * 执行所有拉取股票或基金数据的操作
 *
 * 使用方式:
 *   npm run pull              # 全量拉取基金+股票
 *   npm run pull -- --since 2026-06-24  # 增量拉取
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_DIR = path.resolve(__dirname, '..', 'server');

/**
 * 探测可用的 Python 命令
 * 优先级: py -3 → python3 → python
 */
function findPython() {
  const candidates = [
    { cmd: 'py', args: ['-3'] },
    { cmd: 'python3', args: [] },
    { cmd: 'python', args: [] },
  ];
  for (const { cmd, args } of candidates) {
    try {
      const result = execSync(`"${cmd}" ${args.join(' ')} --version`, {
        encoding: 'utf-8',
        timeout: 5000,
        windowsHide: true,
      }).trim().toLowerCase();
      if (result.includes('python')) {
        return { cmd, args };
      }
    } catch {
      // 尝试下一个
    }
  }
  return null;
}

const PYTHON = findPython();
if (!PYTHON) {
  console.error('[!] 未检测到 Python 环境，无法执行数据采集');
  console.error('   请确保已安装 Python 并在 PATH 中');
  process.exit(1);
}

const { cmd: pythonCmd, args: pythonBaseArgs } = PYTHON;

// 获取 --since 参数
const args = process.argv.slice(2);
const sinceIdx = args.indexOf('--since');
const since = sinceIdx !== -1 ? args[sinceIdx + 1] : null;

const scripts = [
  { file: 'fetch_fund_data.py', name: '基金' },
  { file: 'fetch_stock_data.py', name: '股票' },
];

for (const { file, name } of scripts) {
  const scriptPath = path.resolve(SERVER_DIR, file);
  const pythonArgs = [
    ...pythonBaseArgs,
    `"${scriptPath}"`,
    ...(since ? ['--since', since] : []),
  ];
  const cmd = `cd server && ${pythonCmd} ${pythonArgs.join(' ')}`;

  console.log(`\n[*] 开始采集${name}数据${since ? ` (${since} ~ 今天)` : ' (全量)'}\n`);

  try {
    execSync(cmd, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    console.log(`[+] ${name}数据采集完成`);
  } catch (err) {
    console.error(`[!] ${name}数据采集失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log('\n[+] 全部采集任务完成\n');