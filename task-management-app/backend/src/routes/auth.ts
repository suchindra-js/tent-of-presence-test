import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db';
import config from '../config/config';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

const SALT_ROUNDS = 10;

router.post('/register', async (req, res: Response, next): Promise<void> => {
  try {
    const { email, password, name } = req.body as {
      email?: string;
      password?: string;
      name?: string;
    };

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, created_at, updated_at`,
      [email.trim(), password_hash, name?.trim() || null]
    );

    const user = result.rows[0];
    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      created_at: user.created_at,
      updated_at: user.updated_at,
    });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === '23505') {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    next(err);
  }
});

router.post('/login', asyncHandler(async (req, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const result = await pool.query(
    'SELECT id, email, password_hash, name FROM users WHERE email = $1',
    [email.trim()]
  );

  const row = result.rows[0];
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  if (!config.jwtSecret) {
    res.status(500).json({ error: 'Server misconfiguration' });
    return;
  }

  const token = jwt.sign(
    { userId: row.id, email: row.email },
    config.jwtSecret,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
    },
  });
}));

router.get('/me', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const result = await pool.query(
    'SELECT id, email, name, created_at, updated_at FROM users WHERE id = $1',
    [req.user.userId]
  );

  const user = result.rows[0];
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    created_at: user.created_at,
    updated_at: user.updated_at,
  });
}));

export default router;
