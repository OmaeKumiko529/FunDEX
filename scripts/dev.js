/**
 * FunDEX 统一启动引导程序
 * ========================
 *
 * 交互式选择测试方式，自动启动后端 + 对应 Tauri 模式。
 *
 * 使用方式:
 *   node scripts/dev.js
 *   或 npm run start
 *
 * 测试方式:
 *   1. 本机浏览器 — tauri dev（桌面窗口）
 *   2. 本机模拟器 — 启动 Pixel_10 AVD → tauri android dev
 *   3. 无线 ADB  — 设置 TAURI_DEV_HOST → tauri android dev
 *
 * 依赖: 仅 Node.js 内置模块（readline, child_process, os, path）
 */

import readline from 'node:readline';
import { spawn, execSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SERVER_DIR = path.resolve(ROOT_DIR, 'server');

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const BOLD = '\x1b[1m';

function printBanner() {
  console.log(`
░▒▓████████▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓███████▓▒░░▒▓███████▓▒░░▒▓████████▓▒░▒▓█▓▒░░▒▓█▓▒░      ░▒▓███████▓▒░░▒▓████████▓▒░▒▓█▓▒░░▒▓█▓▒░ 
░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░ 
░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░       ░▒▓█▓▒▒▓█▓▒░  
░▒▓██████▓▒░ ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓██████▓▒░  ░▒▓██████▓▒░       ░▒▓█▓▒░░▒▓█▓▒░▒▓██████▓▒░  ░▒▓█▓▒▒▓█▓▒░  
░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░        ░▒▓█▓▓█▓▒░   
░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░        ░▒▓█▓▓█▓▒░   
░▒▓█▓▒░       ░▒▓██████▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓███████▓▒░░▒▓████████▓▒░▒▓█▓▒░░▒▓█▓▒░      ░▒▓███████▓▒░░▒▓████████▓▒░  ░▒▓██▓▒░                                                                                                                                                                   
  `);
  console.log('+===FunDEX 测试环境启动引导程序===+\n');
}

/**
 * 探测可用的 Python 命令
 * 优先级: py -3 → python3 → python
 * 若全部不可用则返回 null
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
const HAS_PYTHON = PYTHON !== null;

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    if (/vmware|virtualbox|docker|bluetooth/i.test(name)) continue;

    for (const info of iface) {
      if (info.family === 'IPv4' && !info.internal) {
        candidates.push(info.address);
      }
    }
  }

  const pref = candidates.find(
    ip => ip.startsWith('192.168.') || ip.startsWith('10.')
  );
  return pref || candidates[0] || '127.0.0.1';
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function runCommand(cmd, args, options = {}) {
  const {
    cwd = ROOT_DIR,
    env = {},
    waitForText,
    title = cmd,
    inheritStdio = false,
    timeout: timeoutMs = 0,
  } = options;

  const mergedEnv = { ...process.env, ...env };

  console.log(`  ▶ ${title}`);
  console.log(`    ${cmd} ${args.join(' ')}`);

  const child = spawn(cmd, args, {
    cwd,
    env: mergedEnv,
    shell: true,
    stdio: inheritStdio ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });

  const exited = new Promise((resolve, reject) => {
    child.on('close', code => resolve(code));
    child.on('error', err => reject(err));
  });

  if (waitForText && child.stdout) {
    return new Promise((resolve, reject) => {
      let resolved = false;

      // 超时处理：规定时间内未等到目标文本，则拒绝
      let timeoutHandle;
      if (timeoutMs > 0) {
        timeoutHandle = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            child.kill();
            reject(new Error(`等待 "${waitForText}" 超时 (${timeoutMs}ms)`));
          }
        }, timeoutMs);
      }

      const onData = (data) => {
        const text = data.toString();
        process.stdout.write(text);
        if (!resolved && text.includes(waitForText)) {
          resolved = true;
          if (timeoutHandle) clearTimeout(timeoutHandle);
          resolve({ process: child, exited });
        }
      };
      child.stdout.on('data', onData);
      child.stderr?.on('data', (data) => {
        process.stdout.write(data.toString());
      });
      child.on('error', err => {
        if (!resolved) {
          resolved = true;
          if (timeoutHandle) clearTimeout(timeoutHandle);
          reject(err);
        }
      });
      child.on('close', () => {
        if (!resolved) {
          resolved = true;
          if (timeoutHandle) clearTimeout(timeoutHandle);
          resolve({ process: child, exited });
        }
      });
    });
  }

  if (!inheritStdio) {
    child.stdout?.on('data', (data) => process.stdout.write(data));
    child.stderr?.on('data', (data) => process.stdout.write(data));
  }

  return Promise.resolve({ process: child, exited });
}

function getDateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

//启动步骤

async function startBackend() {
  console.log('[*] 启动后端服务\n');

  // 使用 npm start 替代 npx tsx，更可靠（利用 server/node_modules/.bin 中的本地 tsx）
  const backend = await runCommand('npm', ['start'], {
    cwd: SERVER_DIR,
    title: '启动后端服务',
    waitForText: '服务已启动',
    timeout: 30000, // 30 秒内后端必须打印 "服务已启动"
  });

  // 后端就绪后，后台异步拉取增量数据（不阻塞启动流程）
  const since = getDateDaysAgo(7); // 近 7 天

  const runFetch = (script, label) => {
    if (!HAS_PYTHON) {
      console.log(`  [!] 未检测到 Python 环境，跳过 ${label}数据采集`);
      console.log(`      请确保已安装 Python 并在 PATH 中`);
      return;
    }

    const { cmd, args } = PYTHON;
    runCommand(cmd, [...args,
      path.resolve(SERVER_DIR, script),
      '--since', since,
    ], {
      cwd: SERVER_DIR,
      title: `${label}数据采集 (${since} ~ 今天)`,
      inheritStdio: false,
      timeout: 120000, // 2 分钟超时
    }).catch(() => { /* 静默失败，不阻塞主流程 */ });
  };

  runFetch('fetch_fund_data.py', '基金');
  runFetch('fetch_stock_data.py', '股票');

  return backend;
}

async function startEmulator(avdName) {
  console.log(`[*] 启动模拟器: ${avdName}\n`);

  await runCommand('emulator', [`-avd`, avdName, '-no-snapshot-load'], {
    title: '启动 Android 模拟器',
    waitForText: 'boot completed',
    inheritStdio: false,
  });

  console.log(`\n[*] 等待模拟器启动完成...`);

  try {
    execSync('adb wait-for-device', { timeout: 120000, stdio: 'inherit' });
    console.log('[+] ADB 设备已就绪');
  } catch {
    console.log('[!] adb wait-for-device 超时，继续尝试...');
  }

  await new Promise(resolve => {
    const check = setInterval(() => {
      try {
        const boot = execSync(
          'adb shell getprop sys.boot_completed',
          { encoding: 'utf-8', timeout: 5000 }
        ).trim();
        if (boot === '1') {
          clearInterval(check);
          console.log('[+] 模拟器系统启动完成');
          resolve();
        }
      } catch {
        // 重试
      }
    }, 3000);
  });
}

function getTauriAndroidEnv(mode, localIP) {
  if (mode === 'emulator') {
    return { TAURI_DEV_HOST: '10.0.2.2' };
  } else {
    return { TAURI_DEV_HOST: localIP };
  }
}

async function startTauriAndroid(env) {
  console.log('[+] 启动 Tauri Android Dev\n');
  console.log(`     TAURI_DEV_HOST=${env.TAURI_DEV_HOST}`);

  // 使用 npm run tauri 替代 npx tauri，更可靠（利用本地 node_modules/.bin）
  await runCommand('npm', ['run', 'tauri', '--', 'android', 'dev'], {
    title: 'Tauri Android 开发模式',
    env,
    inheritStdio: true,
  });
}

async function startTauriDesktop() {
  console.log('[+] 启动 Tauri Desktop Dev\n');

  // 使用 npm run tauri:dev 替代 npx tauri dev，利用本地 node_modules/.bin
  await runCommand('npm', ['run', 'tauri:dev'], {
    title: 'Tauri 桌面开发模式',
    inheritStdio: true,
  });
}


async function main() {
  printBanner();

  console.log('[*] 请选择测试方式:');
  console.log('[1] Tauri Desktop For Windows (default)');
  console.log('[2] 使用 Android Studio AVD 连接虚拟机');
  console.log('[3] 使用 WiFi ADB 连接');

  const choice = await askQuestion('[#] Type:');

  let mode;
  if (choice === '2') {
    mode = 'emulator';
    console.log('\n[+] 使用 Android Studio AVD 连接虚拟机');
  } else if (choice === '3') {
    mode = 'adb';
    console.log('\n[+] 使用 WiFi ADB 连接');
    console.log('\n[%] 请确保手机已通过 ADB 连接到电脑');
    await askQuestion('[#] 确认后按回车继续\n[#] Type:');
  } else {
    mode = 'browser';
    console.log('\n[+] Tauri Desktop For Windows');
  }

  // ── 步骤 1: 启动后端 ──
  const backend = await startBackend();
  console.log('\n[+] 后端服务已就绪\n');

  // ── 步骤 2: 根据模式执行 ──
  try {
    if (mode === 'browser') {
      await startTauriDesktop();
    } else if (mode === 'emulator') {
      await startEmulator('Pixel_10');
      const env = getTauriAndroidEnv('emulator', '');
      await startTauriAndroid(env);
    } else {
      const localIP = getLocalIP();
      console.log(`\n[%] 本机局域网 IP: ${localIP}`);
      console.log(`[%] Vite 开发服务器: http://${localIP}:5173\n`);
      const env = getTauriAndroidEnv('adb', localIP);
      await startTauriAndroid(env);
    }
  } catch (err) {
    console.error(`\n${RED}${BOLD}[!] 启动失败: ${err instanceof Error ? err.message : String(err)}${RESET}`);
  }

  console.log('\n[*] 等待所有进程退出...\n');
  try {
    const code = await backend.exited;
    console.log(`[!] 后端服务已退出 (code: ${code})\n`);
  } catch (err) {
    console.error('\n[!] 后端退出异常:', err);
  }
}

main().catch(err => {
  console.error(`\n${RED}${BOLD}[!] 启动引导程序异常: ${err instanceof Error ? err.message : String(err)}${RESET}`);
  process.exit(1);
});