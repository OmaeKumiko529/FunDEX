import { execSync } from 'child_process';

// ──────────────────────────────────────────────
//  Python 命令探测工具
//  优先级: py -3 → python3 → python
// ──────────────────────────────────────────────

interface PythonInfo {
  cmd: string;
  args: string[];
}

let cachedPython: PythonInfo | null | undefined = undefined;

/**
 * 探测可用的 Python 命令。
 * 结果会被缓存，多次调用不会重复探测。
 *
 * @returns { cmd, args } 或 null（未找到 Python）
 */
export function findPython(): PythonInfo | null {
  if (cachedPython !== undefined) {
    return cachedPython;
  }

  const candidates: PythonInfo[] = [
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
        cachedPython = { cmd, args };
        return cachedPython;
      }
    } catch {
      // 尝试下一个
    }
  }

  cachedPython = null;
  return null;
}

/**
 * 构建 Python 命令的完整参数列表。
 * 返回可直接传给 spawn 的 args 数组。
 *
 * @param scriptPath Python 脚本绝对路径
 * @param extraArgs 附加参数（如 fund_code、--since 等）
 */
export function buildPythonArgs(scriptPath: string, ...extraArgs: string[]): string[] {
  const py = findPython();
  if (!py) {
    throw new Error('未检测到 Python 环境，请确保已安装 Python 并在 PATH 中');
  }
  return [...py.args, scriptPath, ...extraArgs];
}

/**
 * 获取可执行的 Python 命令（用于 shell 模式）。
 */
export function getPythonCommand(): { cmd: string; args: string[] } | null {
  return findPython();
}