import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/config';
import { AuthenticatedRequest, AuthUser } from '../types/auth';

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  if (!config.jwtSecret) {
    res.status(500).json({ error: 'Server misconfiguration' });
    return;
  }

  jwt.verify(token, config.jwtSecret, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        res.status(401).json({
          error: 'Token expired',
          expiredAt: (err as jwt.TokenExpiredError).expiredAt,
          code: 'TOKEN_EXPIRED',
        });
        return;
      }
      if (err.name === 'NotBeforeError') {
        res.status(401).json({
          error: 'Token not yet valid',
          validFrom: (err as jwt.NotBeforeError).date,
          code: 'TOKEN_NOT_ACTIVE',
        });
        return;
      }
      res.status(401).json({
        error: 'Invalid token',
        message: err.message,
        code: 'TOKEN_INVALID',
      });
      return;
    }

    const payload = decoded as { userId: string; email: string };
    (req as AuthenticatedRequest).user = { userId: payload.userId, email: payload.email } as AuthUser;
    next();
  });
}
