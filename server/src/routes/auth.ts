import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getDB } from '../sql.js';
import type { User, UserPublic, Session } from '../types.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

// ──────────────────────────────────────────────
//  用户认证路由 — 注册 / 登录 / 个人资料
// ──────────────────────────────────────────────

const router = Router();
const SALT_ROUNDS = 10;
const TOKEN_EXPIRY_DAYS = 30;

// ── 头像上传配置 ──
const AVATAR_DIR = path.resolve(import.meta.dirname, '../data/avatars');
if (!fs.existsSync(AVATAR_DIR)) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, AVATAR_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const uniqueName = `avatar_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 JPG/PNG/WebP 格式的头像'));
    }
  },
});

// ── 工具函数 ──

function toUserPublic(user: User, req?: { get?: (header: string) => string | undefined; protocol?: string }): UserPublic {
  let avatarUrl: string | null = null;
  if (user.avatar_path) {
    const host = req?.get?.('host') || 'localhost:3000';
    const protocol = req?.protocol || 'http';
    avatarUrl = `${protocol}://${host}/avatars/${path.basename(user.avatar_path)}`;
  }
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    bio: user.bio,
    avatar_url: avatarUrl,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

function generateToken(): string {
  return crypto.randomUUID();
}

function createSession(userId: number): Session {
  const db = getDB();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .replace('Z', '');

  db.run(
    'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
    userId,
    token,
    expiresAt
  );

  return db.get<Session>('SELECT * FROM sessions WHERE token = ?', token)!;
}

// ── POST /api/auth/register — 注册 ──
router.post('/register', (req: AuthRequest, res: Response): void => {
  const { email, password, display_name } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: '邮箱和密码为必填项' });
    return;
  }

  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: '邮箱格式不正确' });
    return;
  }

  if (typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: '密码长度不能少于6位' });
    return;
  }

  const db = getDB();

  // 检查邮箱是否已注册
  const existing = db.get<User>('SELECT id FROM users WHERE email = ?', email);
  if (existing) {
    res.status(409).json({ error: '该邮箱已注册' });
    return;
  }

  // 创建用户
  const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
  const result = db.run(
    'INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)',
    email,
    passwordHash,
    display_name || email.split('@')[0]
  );

  const userId = Number(result.lastInsertRowid);
  const user = db.get<User>('SELECT * FROM users WHERE id = ?', userId)!;
  const session = createSession(userId);

  res.status(201).json({
    user: toUserPublic(user, req),
    token: session.token,
  });
});

// ── POST /api/auth/login — 登录 ──
router.post('/login', (req: AuthRequest, res: Response): void => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: '邮箱和密码为必填项' });
    return;
  }

  const db = getDB();
  const user = db.get<User>('SELECT * FROM users WHERE email = ?', email);

  if (!user) {
    res.status(401).json({ error: '邮箱或密码错误' });
    return;
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: '邮箱或密码错误' });
    return;
  }

  const session = createSession(user.id);

  res.json({
    user: toUserPublic(user, req),
    token: session.token,
  });
});

// ── GET /api/auth/me — 获取当前用户信息 ──
router.get('/me', requireAuth, (req: AuthRequest, res: Response): void => {
  const db = getDB();
  const user = db.get<User>('SELECT * FROM users WHERE id = ?', req.userId);
  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  res.json({ user: toUserPublic(user, req) });
});

// ── PUT /api/auth/profile — 更新个人资料 ──
router.put('/profile', requireAuth, (req: AuthRequest, res: Response): void => {
  const { display_name, bio } = req.body;

  if (display_name !== undefined && typeof display_name !== 'string') {
    res.status(400).json({ error: 'display_name 应为字符串' });
    return;
  }
  if (bio !== undefined && typeof bio !== 'string') {
    res.status(400).json({ error: 'bio 应为字符串' });
    return;
  }

  const db = getDB();
  const updates: string[] = [];
  const params: unknown[] = [];

  if (display_name !== undefined) {
    updates.push('display_name = ?');
    params.push(display_name);
  }
  if (bio !== undefined) {
    updates.push('bio = ?');
    params.push(bio);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: '没有需要更新的字段' });
    return;
  }

  updates.push("updated_at = datetime('now', 'localtime')");
  params.push(req.userId);

  db.run(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
    ...params
  );

  const user = db.get<User>('SELECT * FROM users WHERE id = ?', req.userId)!;
  res.json({ user: toUserPublic(user, req) });
});

// ── POST /api/auth/avatar — 上传头像 ──
router.post('/avatar', requireAuth, (req: AuthRequest, res: Response): void => {
  upload.single('avatar')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ error: '头像文件大小不能超过 2MB' });
          return;
        }
        res.status(400).json({ error: err.message });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: '请选择头像文件' });
      return;
    }

    const db = getDB();

    // 删除旧头像文件（如果不是默认头像）
    const oldUser = db.get<User>('SELECT avatar_path FROM users WHERE id = ?', req.userId);
    if (oldUser?.avatar_path && fs.existsSync(oldUser.avatar_path)) {
      try {
        fs.unlinkSync(oldUser.avatar_path);
      } catch {
        // 删除失败不影响主流程
      }
    }

    // 更新数据库
    db.run(
      "UPDATE users SET avatar_path = ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
      req.file.path,
      req.userId
    );

    const user = db.get<User>('SELECT * FROM users WHERE id = ?', req.userId)!;
    res.json({ user: toUserPublic(user, req) });
  });
});

// ── POST /api/auth/logout — 退出登录 ──
router.post('/logout', requireAuth, (req: AuthRequest, res: Response): void => {
  const db = getDB();
  db.run('DELETE FROM sessions WHERE token = ?', req.token);
  res.json({ message: '已退出登录' });
});

export default router;