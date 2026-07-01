import { Request, Response, NextFunction } from 'express';
import { getDB } from '../sql.js';
import type { Session } from '../types.js';

// ──────────────────────────────────────────────
//  认证中间件 — 验证 Bearer Token
// ──────────────────────────────────────────────

/** 扩展 Express Request，添加 user 和 token 字段 */
export interface AuthRequest extends Request {
  userId?: number;
  token?: string;
}

/**
 * 验证请求头中的 Authorization: Bearer <token>
 * 成功后将 userId 注入 req，失败返回 401
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: '未提供认证凭证' });
    return;
  }

  const token = authHeader.slice(7);

  const db = getDB();
  const session = db.get<Session>(
    'SELECT * FROM sessions WHERE token = ? AND expires_at > datetime(\'now\', \'localtime\')',
    token
  );

  if (!session) {
    res.status(401).json({ error: '令牌无效或已过期' });
    return;
  }

  req.userId = session.user_id;
  req.token = token;
  next();
}