import { Request } from 'express';

export interface JwtPayload {
  userId: string;
  email: string;
}

export interface AuthUser {
  userId: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
