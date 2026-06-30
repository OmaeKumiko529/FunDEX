import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

/**
 * POST /api/fund-fetch
 * Body: { "fund_code": "000001" }
 *
 * 检查 DB 中是否已有该基金信息，如果没有则调用 Python 爬虫拉取。
 * 幂等：如果 DB 中已有记录，直接返回 success。
 */
router.post('/', (req: Request, res: Response) => {
  const { fund_code } = req.body as { fund_code?: string };

  if (!fund_code || !/^\d{6}$/.test(fund_code)) {
    res.status(400).json({ error: '无效的基金代码，应为6位数字' });
    return;
  }

  const serverDir = path.resolve(__dirname, '../..');
  const pythonScript = path.resolve(serverDir, 'fetch_fund_data.py');

  console.log(`[fund-fetch] 开始获取基金 ${fund_code} 的数据...`);

  const pythonProcess = spawn('python', [pythonScript, fund_code], {
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
      console.log(`[fund-fetch] 基金 ${fund_code} 数据采集成功`);
      res.json({
        data: {
          success: true,
          fund_code,
          message: '数据已获取并写入数据库',
        },
      });
    } else {
      console.error(`[fund-fetch] 基金 ${fund_code} 采集失败 (exit code: ${code})`);
      console.error(`  stderr: ${stderr.slice(0, 500)}`);
      res.status(500).json({
        error: '数据采集失败',
        detail: stderr.slice(0, 200) || `进程退出码: ${code}`,
      });
    }
  });

  pythonProcess.on('error', (err: Error) => {
    console.error(`[fund-fetch] 启动 Python 失败:`, err.message);
    res.status(500).json({ error: `无法启动数据采集: ${err.message}` });
  });
});

export default router;