import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { findPython } from '../python.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

/**
 * POST /api/stock-fetch
 * Body: { "stock_code": "600519" }
 * Body: {} 则从 stock_list.txt 批量抓取
 * Query: ?snapshot=true 仅获取实时快照
 * Query: ?since=2025-01-01 指定起始日期
 *
 * 调用 Python 脚本抓取股票数据并写入 SQLite。
 */
router.post('/', (req: Request, res: Response) => {
  const { stock_code } = req.body as { stock_code?: string };
  const { snapshot, since } = req.query as Record<string, string | undefined>;

  const py = findPython();
  if (!py) {
    res.status(500).json({ error: '未检测到 Python 环境' });
    return;
  }

  const serverDir = path.resolve(__dirname, '../..');
  const pythonScript = path.resolve(serverDir, 'fetch_stock_data.py');

  // 构建参数
  const args: string[] = [...py.args, pythonScript];

  if (snapshot === 'true') {
    args.push('--snapshot');
  }

  if (since) {
    args.push('--since', since);
  }

  if (stock_code && /^\d{6}$/.test(stock_code)) {
    args.push(stock_code);
    console.log(`[stock-fetch] 开始获取股票 ${stock_code} 的数据...`);
  } else {
    console.log('[stock-fetch] 开始从 stock_list.txt 批量获取股票数据...');
  }

  const pythonProcess = spawn(py.cmd, args, {
    cwd: serverDir,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';

  pythonProcess.stdout?.on('data', (data: Buffer) => {
    stdout += data.toString();
  });

  pythonProcess.stderr?.on('data', (data: Buffer) => {
    stderr += data.toString();
  });

  pythonProcess.on('close', (code: number | null) => {
    if (code === 0) {
      const target = stock_code || '批量';
      console.log(`[stock-fetch] 股票 ${target} 数据采集成功`);
      res.json({
        data: {
          success: true,
          stock_code: stock_code || undefined,
          message: '数据已获取并写入数据库',
          output: stdout.slice(0, 1000),
        },
      });
    } else {
      const target = stock_code || '批量';
      console.error(`[stock-fetch] 股票 ${target} 采集失败 (exit code: ${code})`);
      res.status(500).json({
        error: '数据采集失败',
        detail: stderr.slice(0, 200) || stdout.slice(0, 200) || `进程退出码: ${code}`,
      });
    }
  });

  pythonProcess.on('error', (err: Error) => {
    console.error(`[stock-fetch] 启动 Python 失败:`, err.message);
    res.status(500).json({ error: `无法启动数据采集: ${err.message}` });
  });
});

export default router;
