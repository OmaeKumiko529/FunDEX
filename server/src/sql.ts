import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// ──────────────────────────────────────────────
//  SQLite 数据库操作层 —— 单例模式 + 泛型查询
// ──────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_DB_PATH = path.resolve(__dirname, '../data/fundex.db');

/** 行类型：写操作的返回值 */
export interface RunResult {
  changes: number;
  lastInsertRowid: bigint;
}

class SqlDB {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    // WAL 模式：读写并发不阻塞，SQLite 官方推荐
    this.db.pragma('journal_mode = WAL');
    // 启用外键约束
    this.db.pragma('foreign_keys = ON');
  }

  // ─── 查询 ───

  /** 查询多行，泛型 T 为返回的行类型 */
  all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  /** 查询单行，返回 T | undefined */
  get<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }

  // ─── 写入 ───

  /** 执行 INSERT / UPDATE / DELETE，返回影响行数和最后插入 ID */
  run(sql: string, ...params: unknown[]): RunResult {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);
    return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
  }

  /** 批量插入（在事务中执行多条相同结构的 SQL） */
  insertBatch(sql: string, rows: unknown[][]): RunResult {
    const stmt = this.db.prepare(sql);
    let changes = 0;
    let lastInsertRowid = 0n;
    const insertMany = this.db.transaction((items: unknown[][]) => {
      for (const item of items) {
        const r = stmt.run(...item);
        changes += r.changes;
        lastInsertRowid = r.lastInsertRowid;
      }
    });
    insertMany(rows);
    return { changes, lastInsertRowid };
  }

  // ─── 事务 ───

  /** 在事务中执行一个回调函数 */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  // ─── 管理 ───

  /** 执行任意 SQL（多语句，通常用于建表） */
  exec(sql: string): void {
    this.db.exec(sql);
  }

  /** 关闭数据库连接 */
  close(): void {
    this.db.close();
  }
}

// ─── 单例 ───

let instance: SqlDB | null = null;

/**
 * 获取 SqlDB 单例。
 * @param dbPath 可选，默认为 server/data/fundex.db
 */
export function getDB(dbPath?: string): SqlDB {
  if (!instance) {
    instance = new SqlDB(dbPath ?? DEFAULT_DB_PATH);
  }
  return instance;
}

export default SqlDB;